import { promises as fs } from "fs";
import path from "path";
import { publicId } from "./ids";
import { listCatalogue, getCatalogueProduct } from "./catalogue-store";
import { reserveStock, releaseStock, commitStock } from "./inventory";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "os-orders.json";
const TRANSITIONS_FILE = "order-transitions.jsonl";

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

export type OsOrder = {
  id: string;
  orderNumber: string;
  channel: "marketplace" | "pos";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  collectHub: "Westlands" | "Kilimani" | "Karen" | "In-store";
  status: OsOrderStatus;
  items: OsOrderItem[];
  total: number;
  /** Display-only; no tender recorded in M2. */
  totalMinor: number;
  vendorIds: string[];
  /** Primary vendor for single-vendor orders (always set). */
  vendorId: string;
  notes?: string;
  receiptCode?: string;
  createdAt: string;
  updatedAt: string;
  /** INV-6 order-level snapshot bag. */
  snapshot?: {
    currency: "KES";
    placedAt: string;
    itemCount: number;
  };
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<OsOrder[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as OsOrder[];
    return Array.isArray(data) ? data.map(migrateOrder) : [];
  } catch {
    return [];
  }
}

function migrateOrder(o: OsOrder): OsOrder {
  const items = (o.items || []).map((it) => ({
    ...it,
    moneyMinor: it.moneyMinor ?? Math.round((it.unitPrice || 0) * 100),
    vendorId: it.vendorId || o.vendorId || (o.vendorIds && o.vendorIds[0]) || "ven_unknown",
  }));
  const vendorIds = o.vendorIds?.length
    ? o.vendorIds
    : [...new Set(items.map((i) => i.vendorId))];
  return {
    ...o,
    channel: o.channel || "marketplace",
    status: (o.status as OsOrderStatus) || "pending",
    items,
    vendorIds,
    vendorId: o.vendorId || vendorIds[0] || "ven_unknown",
    totalMinor: o.totalMinor ?? Math.round((o.total || 0) * 100),
  };
}

async function writeAll(orders: OsOrder[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, FILE), JSON.stringify(orders, null, 2), "utf8");
}

async function appendTransition(t: OrderTransition) {
  await ensureDir();
  await fs.appendFile(path.join(DATA_DIR, TRANSITIONS_FILE), JSON.stringify(t) + "\n", "utf8");
}

export async function listOrderTransitions(orderId?: string, limit = 100): Promise<OrderTransition[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, TRANSITIONS_FILE), "utf8");
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as OrderTransition)
      .reverse();
    const filtered = orderId ? rows.filter((r) => r.orderId === orderId) : rows;
    return filtered.slice(0, limit);
  } catch {
    return [];
  }
}

export async function listOsOrders(vendorId?: string): Promise<OsOrder[]> {
  const all = await readAll();
  if (!vendorId) return all;
  return all.filter((o) => o.vendorId === vendorId || o.vendorIds.includes(vendorId));
}

export async function getOsOrder(id: string): Promise<OsOrder | null> {
  const all = await readAll();
  return all.find((o) => o.id === id || o.orderNumber === id) || null;
}

export type TransitionResult =
  | { ok: true; order: OsOrder; transition: OrderTransition }
  | { ok: false; code: string; message: string; transition?: OrderTransition };

/**
 * INV-4: only via this transition helper — never raw status UPDATE.
 * Illegal transitions are rejected AND logged.
 */
export async function transitionOsOrder(input: {
  id: string;
  to: OsOrderStatus;
  actorUserId?: string;
  reason?: string;
}): Promise<TransitionResult> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === input.id);
  if (idx < 0) return { ok: false, code: "NOT_FOUND", message: "Order not found" };

  const order = all[idx];
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

  all[idx] = { ...order, status: input.to, updatedAt: now };
  await writeAll(all);
  return { ok: true, order: all[idx], transition };
}

/** @deprecated Prefer transitionOsOrder — kept for seed demos. */
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
      vendorId: product.vendorId,
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
}): Promise<{ ok: true; order: OsOrder } | { ok: false; code: string; message: string }> {
  const snap = await snapshotItems(input.items);
  if ("error" in snap) return { ok: false, code: "NOT_FOUND", message: snap.error };

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
  const totalMinor = snap.reduce((s, it) => s + it.moneyMinor * it.quantity, 0);
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
    createdAt: now,
    updatedAt: now,
    snapshot: {
      currency: "KES",
      placedAt: now,
      itemCount: snap.reduce((s, i) => s + i.quantity, 0),
    },
  };

  const all = await readAll();
  all.unshift(order);
  await writeAll(all);

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
 * Money-free POS sale: direct commit stock + collected order + receipt.
 * No tender / ledger (Chapter 05 M2 constraint).
 */
export async function createPosSale(input: {
  items: { productId: string; quantity: number }[];
  operatorUserId: string;
  operatorName?: string;
  vendorId: string;
}): Promise<{ ok: true; order: OsOrder } | { ok: false; code: string; message: string }> {
  const snap = await snapshotItems(input.items);
  if ("error" in snap) return { ok: false, code: "NOT_FOUND", message: snap.error };

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
  const order: OsOrder = {
    id: tempId,
    orderNumber: receiptCode,
    channel: "pos",
    customerName: "Walk-in",
    customerEmail: "pos@local",
    customerPhone: "n/a",
    collectHub: "In-store",
    status: "collected",
    items: snap,
    total: totalMinor / 100,
    totalMinor,
    vendorIds: [input.vendorId],
    vendorId: input.vendorId,
    notes: `Money-free POS sale · operator ${input.operatorName || input.operatorUserId} · no tender`,
    receiptCode,
    createdAt: now,
    updatedAt: now,
    snapshot: {
      currency: "KES",
      placedAt: now,
      itemCount: snap.reduce((s, i) => s + i.quantity, 0),
    },
  };

  const all = await readAll();
  all.unshift(order);
  await writeAll(all);
  await appendTransition({
    id: publicId("otr"),
    orderId: order.id,
    from: "pending",
    to: "collected",
    actorUserId: input.operatorUserId,
    reason: "POS sale completed (money-free)",
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
    // Seed without reservation failure — bump onHand if needed
    const result = await createOsOrder(d);
    if (result.ok) n += 1;
  }
  void now;
  return n;
}
