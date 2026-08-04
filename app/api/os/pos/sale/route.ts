import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope } from "@/lib/auth/vendor-scope";
import { createPosSale } from "@/lib/orders-store";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";
import { appendUsageEvent } from "@/lib/m1-store";
import { publicId } from "@/lib/ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { upsertVendorCustomerFromOrder } from "@/lib/vendor-customers";

type Tender = "cash" | "mpesa" | "card";

/**
 * POS sale - tenant-scoped, tender recorded, shared inventory decrement.
 */
export async function POST(request: NextRequest) {
  const gate = await requireVendorPermission("pos:sale");
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "items required" } },
      { status: 400 },
    );
  }

  const vendorId = String(body?.vendorId || "");
  if (!vendorId || !inVendorScope(gate.actor, vendorId)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "vendorId required and must be in your membership scope",
        },
      },
      { status: 403 },
    );
  }

  const tenderRaw = String(body?.tender || "cash").toLowerCase();
  const tender: Tender =
    tenderRaw === "mpesa" || tenderRaw === "card" ? tenderRaw : "cash";
  const storeId = body?.storeId ? String(body.storeId) : undefined;

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(
    key,
    "POST /api/os/pos/sale",
    async () => {
      const sale = await createPosSale({
        items: items.map((i: { productId: string; quantity: number }) => ({
          productId: String(i.productId),
          quantity: Number(i.quantity) || 1,
        })),
        operatorUserId: gate.actor.userId,
        operatorName: gate.actor.email || undefined,
        vendorId,
        tender,
        storeId: storeId || null,
        customerName:
          body?.customerName != null ? String(body.customerName) : null,
        customerEmail:
          body?.customerEmail != null ? String(body.customerEmail) : null,
        customerPhone:
          body?.customerPhone != null ? String(body.customerPhone) : null,
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
          tender,
          storeId: storeId || null,
        },
        actorType: "vendor",
        createdAt: new Date().toISOString(),
      });

      await emitVendorActivity({
        vendorPublicId: vendorId,
        kind: "pos",
        title: `POS sale · ${sale.order.receiptCode || sale.order.orderNumber}`,
        body: `${(sale.order.totalMinor / 100).toFixed(2)} KES · ${tender}`,
        refType: "order",
        refId: sale.order.id,
        meta: { tender, storeId, totalMinor: sale.order.totalMinor },
      });

      const customerEmail =
        body?.customerEmail != null ? String(body.customerEmail) : null;
      const customerPhone =
        body?.customerPhone != null ? String(body.customerPhone) : null;
      if (customerEmail || customerPhone) {
        await upsertVendorCustomerFromOrder({
          vendorPublicId: vendorId,
          email: customerEmail,
          phone: customerPhone,
          name: body?.customerName ? String(body.customerName) : null,
          totalMinor: sale.order.totalMinor,
          orderedAt: sale.order.createdAt,
        });
      }

      return {
        status: 201,
        body: {
          data: sale.order,
          receipt: {
            code: sale.order.receiptCode,
            totalMinor: sale.order.totalMinor,
            currency: "KES",
            items: sale.order.items,
            tender,
            note: `Tender: ${tender}${storeId ? ` · store ${storeId}` : ""}`,
          },
        },
      };
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
