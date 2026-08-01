import { NextRequest, NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { createPosSale } from "@/lib/orders-store";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";
import { appendUsageEvent } from "@/lib/m1-store";
import { publicId } from "@/lib/ids";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";

/**
 * Money-free POS sale (Chapter 05 M2).
 * Completes sale, decrements shared inventory, issues receipt — no tender.
 */
export async function POST(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "items required" } },
      { status: 400 },
    );
  }

  const vendorId =
    String(body?.vendorId || "") ||
    gate.actor.vendorIds[0] ||
    DEMO_VENDOR_ID;

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(key, "POST /api/os/pos/sale", async () => {
    const sale = await createPosSale({
      items: items.map((i: { productId: string; quantity: number }) => ({
        productId: String(i.productId),
        quantity: Number(i.quantity) || 1,
      })),
      operatorUserId: gate.actor.userId,
      operatorName: gate.actor.email || undefined,
      vendorId,
    });

    if (!sale.ok) {
      return {
        status: 400,
        body: { error: { code: sale.code, message: sale.message } },
      };
    }

    await appendUsageEvent({
      id: publicId("evt"),
      name: "os.pos_sale",
      properties: {
        orderId: sale.order.id,
        receiptCode: sale.order.receiptCode,
        totalMinor: sale.order.totalMinor,
        itemCount: sale.order.snapshot?.itemCount,
        tender: null,
      },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return {
      status: 201,
      body: {
        data: sale.order,
        receipt: {
          code: sale.order.receiptCode,
          totalMinor: sale.order.totalMinor,
          currency: "KES",
          items: sale.order.items,
          note: "Display-only total — no tender recorded (M2)",
        },
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
