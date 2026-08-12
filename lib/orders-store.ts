import { publicId } from "./ids";
import { listCatalogue, getCatalogueProduct } from "./catalogue-store";
import { reserveStock, releaseStock, commitStock } from "./inventory";
import { getServiceSupabase } from "@/lib/supabase/admin";

/**
 * Order lifecycle (Chapter 05 M2):
 * pending → confirmed (accept) → preparing (prepare) → ready → collected (delivered)
 * pending|confirmed|preparing → cancelled
 */
export type OsOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "collected"
  | "cancelled";

export const ORDER_TRANSITIONS: Record<OsOrderStatus, OsOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "cancelled"],
  collected: [],
  cancelled: [],
};

/** INV-6 line snapshot at order time. */
export type OsOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  moneyMinor: number;
  vendorId: string;
  image?: string;
  barcode?: string;
};

export type OrderTransition = {
  id: string;
  orderId: string;
  from: OsOrderStatus;
  to: OsOrderStatus;
  actorUserId?: string;
  reason?: string;
  createdAt: string;
  illegal?: boolean;
};

/** Authoritative delivery point stored on delivery orders (038). */
export type OrderDeliveryPoint = {
  lat: number | null;
  lng: number | null;
  landmark?: string | null;
  instructions?: string | null;
  confidence?: string | null;
  placeId?: string | null;
};

export type OsOrder = {
  id: string;
  orderNumber: string;
  channel: "marketplace" | "pos";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  collectHub: string;
  status: OsOrderStatus;
  items: OsOrderItem[];
  total: number;
  totalMinor: number;
  vendorIds: string[];
  /** Primary vendor for single-vendor orders (always set). */
  vendorId: string;
  notes?: string;
  receiptCode?: string;
  /** Delivery coordinates + rider context (delivery orders only). */
  delivery?: OrderDeliveryPoint;
  createdAt: string;
  updatedAt: string;
  /** INV-6 order-level snapshot bag. */
  snapshot?: {
    currency: "KES";
    placedAt: string;
    itemCount: number;
    storePublicId?: string;
    storeName?: string;
    tender?: "cash" | "mpesa" | "card";
    operatorUserId?: string;
    /** Gift wrap / platform fee in minor units (KES cents). */
    feeMinor?: number;
  };
};

function mapDbOrder(
  row: Record<string, unknown>,
  items: OsOrderItem[],
): OsOrder {
  const vendorIds = Array.isArray(row.vendor_ids)
    ? (row.vendor_ids as string[])
    : [];
  return {
    id: String(row.public_id),
    orderNumber: String(row.order_number),
    channel: (row.channel as OsOrder["channel"]) || "marketplace",
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone || ""),
    collectHub: (row.collect_hub as OsOrder["collectHub"]) || "Westlands",
    status: (row.status as OsOrderStatus) || "pending",
    items,
    total: Number(row.total_minor || 0) / 100,
    totalMinor: Number(row.total_minor || 0),
    vendorIds,
    vendorId: vendorIds[0] || "ven_unknown",
    notes: row.notes ? String(row.notes) : undefined,
    receiptCode: row.receipt_code ? String(row.receipt_code) : undefined,
    delivery:
      row.delivery_lat != null && row.delivery_lng != null
        ? {
            lat: Number(row.delivery_lat),
            lng: Number(row.delivery_lng),
            landmark: row.delivery_landmark
              ? String(row.delivery_landmark)
              : null,
            instructions: row.delivery_instructions
              ? String(row.delivery_instructions)
              : null,
            confidence: row.delivery_confidence
              ? String(row.delivery_confidence)
              : null,
            placeId: row.delivery_place_id
              ? String(row.delivery_place_id)
              : null,
          }
        : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    snapshot: row.snapshot as OsOrder["snapshot"],
  };
}

async function loadItems(orderUuid: string): Promise<OsOrderItem[]> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("order_items")
    .select("*")
    .eq("order_id", orderUuid);
  return (data || []).map((it) => ({
    productId: it.offer_public_id || it.product_public_id,
    name: it.name,
    quantity: it.quantity,
    unitPrice: Number(it.unit_price_minor || 0) / 100,
    moneyMinor: Number(it.unit_price_minor || 0),
    vendorId: it.vendor_public_id || "ven_unknown",
    image: it.image_url || undefined,
    barcode: it.barcode || undefined,
  }));
}

async function readAll(): Promise<OsOrder[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: OsOrder[] = [];
  for (const row of data || []) {
    out.push(
      mapDbOrder(row as Record<string, unknown>, await loadItems(row.id)),
    );
  }
  return out;
}

async function persistOrder(order: OsOrder): Promise<void> {
  const sb = getServiceSupabase();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id")
    .eq("public_id", order.vendorId)
    .maybeSingle();

  const { data: existing } = await sb
    .from("orders")
    .select("id")
    .eq("public_id", order.id)
    .maybeSingle();

  const payload = {
    public_id: order.id,
    order_number: order.orderNumber,
    channel: order.channel,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone,
    collect_hub: order.collectHub,
    status: order.status,
    total_minor: order.totalMinor,
    vendor_id: vendor?.id || null,
    vendor_ids: order.vendorIds,
    notes: order.notes || null,
    receipt_code: order.receiptCode || null,
    delivery_lat: order.delivery?.lat ?? null,
    delivery_lng: order.delivery?.lng ?? null,
    delivery_landmark: order.delivery?.landmark ?? null,
    delivery_instructions: order.delivery?.instructions ?? null,
    delivery_confidence: order.delivery?.confidence ?? null,
    delivery_place_id: order.delivery?.placeId ?? null,
    snapshot: order.snapshot || null,
    updated_at: order.updatedAt,
  };

  let orderUuid = existing?.id as string | undefined;
  if (existing) {
    await sb.from("orders").update(payload).eq("id", existing.id);
  } else {
    const { data, error } = await sb
      .from("orders")
      .insert({ ...payload, created_at: order.createdAt })
      .select("id")
      .single();
    if (error) throw error;
    orderUuid = data.id;
    await sb.from("order_items").insert(
      order.items.map((it) => ({
        order_id: orderUuid,
        product_public_id: it.productId,
        offer_public_id: it.productId,
        name: it.name,
        quantity: it.quantity,
        unit_price_minor: it.moneyMinor,
        vendor_public_id: it.vendorId,
        image_url: it.image || null,
        barcode: it.barcode || null,
      })),
    );
  }
}

async function appendTransition(t: OrderTransition) {
  const sb = getServiceSupabase();
  const { data: order } = await sb
    .from("orders")
    .select("id")
    .eq("public_id", t.orderId)
    .maybeSingle();
  if (!order) return;
  await sb.from("order_transitions").insert({
    order_id: order.id,
    from_status: t.from,
    to_status: t.to,
    actor_user_id: t.actorUserId || null,
    reason: t.reason || null,
    illegal: t.illegal || false,
    created_at: t.createdAt,
  });
}

export async function listOrderTransitions(
  orderId?: string,
  limit = 100,
): Promise<OrderTransition[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from("order_transitions")
    .select("*, orders(public_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (orderId) {
    const { data: order } = await sb
      .from("orders")
      .select("id")
      .or(`public_id.eq.${orderId},order_number.eq.${orderId}`)
      .maybeSingle();
    if (!order) return [];
    q = q.eq("order_id", order.id);
  }
  const { data } = await q;
  return (data || []).map((r) => ({
    id: r.id,
    orderId: (r as { orders?: { public_id?: string } }).orders?.public_id || "",
    from: r.from_status as OsOrderStatus,
    to: r.to_status as OsOrderStatus,
    actorUserId: r.actor_user_id || undefined,
    reason: r.reason || undefined,
    createdAt: r.created_at,
    illegal: r.illegal || undefined,
  }));
}

export async function listOsOrders(vendorId?: string): Promise<OsOrder[]> {
  const all = await readAll();
  if (!vendorId) return all;
  return all.filter(
    (o) => o.vendorId === vendorId || o.vendorIds.includes(vendorId),
  );
}

export async function getOsOrder(id: string): Promise<OsOrder | null> {
  if (!id) return null;
  const sb = getServiceSupabase();
  const { data: row } = await sb
    .from("orders")
    .select("*")
    .or(`public_id.eq.${id},order_number.eq.${id}`)
    .maybeSingle();
  if (!row) return null;
  return mapDbOrder(
    row as Record<string, unknown>,
    await loadItems(String(row.id)),
  );
}

export type TransitionResult =
  | { ok: true; order: OsOrder; transition: OrderTransition }
  | { ok: false; code: string; message: string; transition?: OrderTransition };

export async function assignOsOrderBranch(input: {
  id: string;
  storePublicId: string;
  storeName: string;
  actorUserId?: string;
}): Promise<
  { ok: true; order: OsOrder } | { ok: false; code: string; message: string }
> {
  const order = await getOsOrder(input.id);
  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found" };
  }
  const next: OsOrder = {
    ...order,
    collectHub: input.storeName || input.storePublicId,
    updatedAt: new Date().toISOString(),
    snapshot: {
      currency: "KES",
      placedAt: order.snapshot?.placedAt || order.createdAt,
      itemCount: order.snapshot?.itemCount ?? order.items.length,
      storePublicId: input.storePublicId,
      storeName: input.storeName,
    },
  };
  await persistOrder(next);
  return { ok: true, order: next };
}

/**
 * INV-4: only via this transition helper - never raw status UPDATE.
 * Illegal transitions are rejected AND logged.
 */
export async function transitionOsOrder(input: {
  id: string;
  to: OsOrderStatus;
  actorUserId?: string;
  reason?: string;
}): Promise<TransitionResult> {
  const order = await getOsOrder(input.id);
  if (!order)
    return { ok: false, code: "NOT_FOUND", message: "Order not found" };

  const from = order.status;
  const allowed = ORDER_TRANSITIONS[from] || [];
  const now = new Date().toISOString();

  if (!allowed.includes(input.to)) {
    const illegal: OrderTransition = {
      id: publicId("otr"),
      orderId: order.id,
      from,
      to: input.to,
      actorUserId: input.actorUserId,
      reason: input.reason || "Illegal transition rejected",
      createdAt: now,
      illegal: true,
    };
    await appendTransition(illegal);
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      message: `Cannot move ${from} → ${input.to}`,
      transition: illegal,
    };
  }

  // Inventory effects
  if (input.to === "cancelled" && from !== "collected") {
    for (const item of order.items) {
      await releaseStock({
        productId: item.productId,
        quantity: item.quantity,
        refType: "order",
        refId: order.id,
        actorUserId: input.actorUserId,
      });
    }
  }
  if (input.to === "collected" && order.channel === "marketplace") {
    for (const item of order.items) {
      await commitStock({
        productId: item.productId,
        quantity: item.quantity,
        refType: "order",
        refId: order.id,
        actorUserId: input.actorUserId,
      });
    }
    // Separate charges & transfers: release Stripe vendor payouts after pickup
    try {
      const { releaseTransfersForOrder } = await import(
        "@/lib/stripe/transfers"
      );
      await releaseTransfersForOrder(order.id);
    } catch (e) {
      console.error("[transitionOsOrder] stripe transfer release", e);
    }
  }

  const transition: OrderTransition = {
    id: publicId("otr"),
    orderId: order.id,
    from,
    to: input.to,
    actorUserId: input.actorUserId,
    reason: input.reason,
    createdAt: now,
  };
  await appendTransition(transition);

  const updated = { ...order, status: input.to, updatedAt: now };
  await persistOrder(updated);
  return { ok: true, order: updated, transition };
}

/** @deprecated Prefer transitionOsOrder - kept for seed demos. */
export async function updateOsOrderStatus(
  id: string,
  status: OsOrderStatus,
): Promise<OsOrder | null> {
  const result = await transitionOsOrder({ id, to: status });
  return result.ok ? result.order : null;
}

async function snapshotItems(
  lines: { productId: string; quantity: number }[],
): Promise<OsOrderItem[] | { error: string }> {
  const items: OsOrderItem[] = [];
  for (const line of lines) {
    const product = await getCatalogueProduct(line.productId);
    if (!product) return { error: `${line.productId} not found` };
    const unitPrice = product.price ?? 0;
    items.push({
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPrice,
      moneyMinor: product.moneyMinor ?? Math.round(unitPrice * 100),
      vendorId: product.vendorId || "ven_unknown",
      image: product.image,
      barcode: product.barcode || product.gtin,
    });
  }
  return items;
}

/**
 * Create one marketplace order for a single vendor (split upstream).
 * Reserves stock (INV-7). No tender.
 */
export async function createOsOrder(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { productId: string; quantity: number }[];
  notes?: string;
  collectHub?: OsOrder["collectHub"];
  channel?: "marketplace" | "pos";
  actorUserId?: string;
  vendorId?: string;
  /** Extra fees in minor units (e.g. gift wrap) added to order total */
  feeMinor?: number;
  /** Authoritative delivery point (delivery orders) */
  delivery?: OrderDeliveryPoint;
}): Promise<
  { ok: true; order: OsOrder } | { ok: false; code: string; message: string }
> {
  const snap = await snapshotItems(input.items);
  if ("error" in snap)
    return { ok: false, code: "NOT_FOUND", message: snap.error };

  const vendorIds = [...new Set(snap.map((i) => i.vendorId))];
  if (vendorIds.length !== 1 && input.channel !== "pos") {
    return {
      ok: false,
      code: "MULTI_VENDOR",
      message: "Create one order per vendor",
    };
  }
  const vendorId = input.vendorId || vendorIds[0];

  const tempId = publicId("ord");
  // Reserve before write
  for (const item of snap) {
    const r = await reserveStock({
      productId: item.productId,
      quantity: item.quantity,
      refType: input.channel === "pos" ? "pos" : "order",
      refId: tempId,
      actorUserId: input.actorUserId,
    });
    if (!r.ok) {
      // roll back prior reserves
      for (const done of snap) {
        if (done.productId === item.productId) break;
        await releaseStock({
          productId: done.productId,
          quantity: done.quantity,
          refType: "order",
          refId: tempId,
          actorUserId: input.actorUserId,
        });
      }
      return { ok: false, code: r.code, message: r.message };
    }
  }

  const now = new Date().toISOString();
  const feeMinor = Math.max(0, Math.round(Number(input.feeMinor) || 0));
  const itemsMinor = snap.reduce(
    (s, it) => s + it.moneyMinor * it.quantity,
    0,
  );
  const totalMinor = itemsMinor + feeMinor;
  const order: OsOrder = {
    id: tempId,
    orderNumber: `KC-${Math.floor(1000 + Math.random() * 9000)}`,
    channel: input.channel || "marketplace",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    collectHub: input.collectHub || "Westlands",
    status: "pending",
    items: snap,
    total: totalMinor / 100,
    totalMinor,
    vendorIds: [vendorId],
    vendorId,
    notes: input.notes,
    delivery: input.delivery,
    createdAt: now,
    updatedAt: now,
    snapshot: {
      currency: "KES",
      placedAt: now,
      itemCount: snap.reduce((s, i) => s + i.quantity, 0),
      feeMinor: feeMinor || undefined,
    },
  };

  await persistOrder(order);

  await appendTransition({
    id: publicId("otr"),
    orderId: order.id,
    from: "pending",
    to: "pending",
    actorUserId: input.actorUserId,
    reason: "Order created",
    createdAt: now,
  });

  return { ok: true, order };
}

/**
 * POS sale: commit stock + collected order + receipt with tender on the order.
 * Platform ledger capture remains via Paystack for online; POS tender is store-recorded.
 */
export async function createPosSale(input: {
  items: { productId: string; quantity: number }[];
  operatorUserId: string;
  operatorName?: string;
  vendorId: string;
  tender?: "cash" | "mpesa" | "card";
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  storeId?: string | null;
}): Promise<
  { ok: true; order: OsOrder } | { ok: false; code: string; message: string }
> {
  const snap = await snapshotItems(input.items);
  if ("error" in snap)
    return { ok: false, code: "NOT_FOUND", message: snap.error };

  const tender = input.tender || "cash";
  const tempId = publicId("ord");
  for (const item of snap) {
    const r = await commitStock({
      productId: item.productId,
      quantity: item.quantity,
      refType: "pos",
      refId: tempId,
      actorUserId: input.operatorUserId,
      directSale: true,
    });
    if (!r.ok) {
      return { ok: false, code: r.code, message: r.message };
    }
  }

  const now = new Date().toISOString();
  const totalMinor = snap.reduce((s, it) => s + it.moneyMinor * it.quantity, 0);
  const receiptCode = `POS-${Date.now().toString(36).toUpperCase()}`;
  const customerName = (input.customerName || "").trim() || "Walk-in";
  const customerEmail = (input.customerEmail || "").trim() || "pos@local";
  const customerPhone = (input.customerPhone || "").trim() || "n/a";
  const order: OsOrder = {
    id: tempId,
    orderNumber: receiptCode,
    channel: "pos",
    customerName,
    customerEmail,
    customerPhone,
    collectHub: "In-store",
    status: "collected",
    items: snap,
    total: totalMinor / 100,
    totalMinor,
    vendorIds: [input.vendorId],
    vendorId: input.vendorId,
    notes: `POS · ${tender} · operator ${input.operatorName || input.operatorUserId}`,
    receiptCode,
    createdAt: now,
    updatedAt: now,
    snapshot: {
      currency: "KES",
      placedAt: now,
      itemCount: snap.reduce((s, i) => s + i.quantity, 0),
      tender,
      operatorUserId: input.operatorUserId,
      storePublicId: input.storeId || undefined,
    },
  };

  await persistOrder(order);
  await appendTransition({
    id: publicId("otr"),
    orderId: order.id,
    from: "pending",
    to: "collected",
    actorUserId: input.operatorUserId,
    reason: `POS sale completed · tender ${tender}`,
    createdAt: now,
  });

  return { ok: true, order };
}

export async function ensureOrderSeed(): Promise<number> {
  const existing = await readAll();
  if (existing.length) return existing.length;

  const catalogue = await listCatalogue();
  if (catalogue.length < 2) return 0;

  const pick = (i: number) => catalogue[i % catalogue.length];
  const now = Date.now();

  const demos: Parameters<typeof createOsOrder>[0][] = [
    {
      customerName: "Wanjiku Mwangi",
      customerEmail: "wanjiku.m@gmail.com",
      customerPhone: "+254712890123",
      collectHub: "Westlands",
      items: [{ productId: pick(0).id, quantity: 1 }],
      notes: "Collect after 5pm",
    },
    {
      customerName: "James Otieno",
      customerEmail: "j.otieno@company.co.ke",
      customerPhone: "+254722456789",
      collectHub: "Kilimani",
      items: [
        { productId: pick(2).id, quantity: 1 },
        { productId: pick(5).id, quantity: 2 },
      ],
    },
  ];

  let n = 0;
  for (const d of demos) {
    // Seed without reservation failure - bump onHand if needed
    const result = await createOsOrder(d);
    if (result.ok) n += 1;
  }
  void now;
  return n;
}
