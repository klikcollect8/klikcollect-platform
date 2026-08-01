import { NextRequest, NextResponse } from "next/server";
import {
  ensureOrderSeed,
  listOsOrders,
  transitionOsOrder,
  listOrderTransitions,
  type OsOrderStatus,
  ORDER_TRANSITIONS,
} from "@/lib/orders-store";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";

export async function GET(request: NextRequest) {
  await ensureOrderSeed();
  const orderId = request.nextUrl.searchParams.get("orderId") || undefined;
  if (request.nextUrl.searchParams.get("transitions") === "1") {
    const transitions = await listOrderTransitions(orderId);
    return NextResponse.json({ data: transitions });
  }
  const orders = await listOsOrders();
  return NextResponse.json({
    data: orders,
    meta: { transitions: ORDER_TRANSITIONS },
  });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const id = String(body?.id || "");
  const status = String(body?.status || "") as OsOrderStatus;
  if (!id || !status) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "id and status required" } },
      { status: 400 },
    );
  }

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(key, `PATCH /api/os/orders:${id}:${status}`, async () => {
    const transitioned = await transitionOsOrder({
      id,
      to: status,
      actorUserId: gate.actor.userId,
      reason: body?.reason,
    });

    if (!transitioned.ok) {
      return {
        status: transitioned.code === "NOT_FOUND" ? 404 : 409,
        body: {
          error: {
            code: transitioned.code,
            message: transitioned.message,
          },
          transition: transitioned.transition,
        },
      };
    }

    await appendUsageEvent({
      id: publicId("evt"),
      name: "os.order_status_changed",
      properties: {
        orderId: id,
        status,
        from: transitioned.transition.from,
        orderNumber: transitioned.order.orderNumber,
        actorUserId: gate.actor.userId,
      },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return { status: 200, body: { data: transitioned.order, transition: transitioned.transition } };
  });

  return NextResponse.json(result.body, { status: result.status });
}
