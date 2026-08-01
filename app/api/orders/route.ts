import { NextRequest, NextResponse } from "next/server";
import { requireClerkUser, unauthorizedJson } from "@/lib/auth/require-clerk-user";
import { createOsOrder, listOsOrders, ensureOrderSeed } from "@/lib/orders-store";
import { appendUsageEvent } from "@/lib/m1-store";
import { publicId } from "@/lib/ids";
import { getCatalogueProduct } from "@/lib/catalogue-store";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";

export async function GET() {
  try {
      await ensureOrderSeed();
    const orders = await listOsOrders();
    return NextResponse.json({ data: orders });
  } catch {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch orders" } },
      { status: 500 },
    );
  }
}

/**
 * Place marketplace order(s) — one per vendor (Chapter 05 M2).
 * Display-only totals; reserves stock; no tender.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();

    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      items,
      pickupDate,
      pickupTime,
      giftWrap,
      giftMessage,
    } = body;

    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !pickupDate ||
      !pickupTime
    ) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "Missing required fields" } },
        { status: 400 },
      );
    }

  
    type Line = { productId: string; quantity: number; vendorId: string };
    const lines: Line[] = [];
    for (const item of items) {
      // Cart lines key inventory by offer id (flattened catalogue row id)
      const offerOrProductId = String(
        item.offerId || item.product?.id || item.productId || "",
      );
      const quantity = Number(item.quantity) || 0;
      const product = await getCatalogueProduct(offerOrProductId);
      if (!product) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `${offerOrProductId} unavailable` } },
          { status: 400 },
        );
      }
      lines.push({
        productId: product.id,
        quantity,
        vendorId: product.vendorId || "ven_unknown",
      });
    }

    const byVendor = new Map<string, Line[]>();
    for (const line of lines) {
      const bucket = byVendor.get(line.vendorId) || [];
      bucket.push(line);
      byVendor.set(line.vendorId, bucket);
    }

    const notes = [
      `Pickup ${pickupDate} ${pickupTime}`,
      giftWrap ? "Gift wrap" : null,
      giftMessage ? `Gift: ${giftMessage}` : null,
      `clerk:${actor.userId}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const key = idempotencyKeyFrom(request);
    const result = await withIdempotency(key, "POST /api/orders", async () => {
      const created = [];
      for (const [vendorId, vendorLines] of byVendor) {
        const r = await createOsOrder({
          customerName,
          customerEmail,
          customerPhone,
          items: vendorLines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
          notes,
          vendorId,
          actorUserId: actor.userId,
          channel: "marketplace",
        });
        if (!r.ok) {
          return {
            status: 400,
            body: { error: { code: r.code, message: r.message } } as const,
          };
        }
        created.push(r.order);
      }

      await appendUsageEvent({
        id: publicId("evt"),
        name: "marketplace.order_placed",
        properties: {
          orderIds: created.map((o) => o.id),
          orderCount: created.length,
          totalMinor: created.reduce((s, o) => s + o.totalMinor, 0),
        },
        actorType: "customer",
        createdAt: new Date().toISOString(),
      });

      const primary = created[0];
      return {
        status: 201,
        body: {
          data: created,
          id: primary.id,
          orders: created,
          orderNumber: primary.orderNumber,
          total: primary.total,
          totalMinor: primary.totalMinor,
        },
      };
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.replayed ? { "Idempotency-Replayed": "true" } : undefined,
    });
  } catch (error) {
    console.error("[api/orders POST]", error);
    return NextResponse.json(
      { error: { code: "CREATE_FAILED", message: "Failed to create order" } },
      { status: 500 },
    );
  }
}
