import { NextRequest, NextResponse } from "next/server";
import {
  ensureOrderSeed,
  listOsOrders,
  transitionOsOrder,
  assignOsOrderBranch,
  listOrderTransitions,
  type OsOrderStatus,
  ORDER_TRANSITIONS,
} from "@/lib/orders-store";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import {
  requireVendorActor,
  requireVendorPermission,
} from "@/lib/auth/require-vendor";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";
import { upsertVendorCustomerFromOrder } from "@/lib/vendor-customers";

export async function GET(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  await ensureOrderSeed();
  const orderId = request.nextUrl.searchParams.get("orderId") || undefined;
  if (request.nextUrl.searchParams.get("transitions") === "1") {
    const transitions = await listOrderTransitions(orderId);
    return NextResponse.json({ data: transitions });
  }

  const all = await listOsOrders();
  const allowed = new Set(gate.actor.vendorIds);
  const orders = all.filter(
    (o) => allowed.has(o.vendorId) || o.vendorIds.some((id) => allowed.has(id)),
  );

  return NextResponse.json({
    data: orders,
    meta: { transitions: ORDER_TRANSITIONS },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "id required" } },
      { status: 400 },
    );
  }

  // Branch assign without status change.
  if (body?.storeId || body?.storePublicId) {
    const gate = await requireVendorPermission("orders:fulfill");
    if (!gate.ok) return gate.response;
    const storePublicId = String(body.storeId || body.storePublicId);
    const storeName = String(
      body.storeName || body.collectHub || storePublicId,
    );
    const assigned = await assignOsOrderBranch({
      id,
      storePublicId,
      storeName,
      actorUserId: gate.actor.userId,
    });
    if (!assigned.ok) {
      return NextResponse.json(
        { error: { code: assigned.code, message: assigned.message } },
        { status: assigned.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    if (
      assigned.order.vendorId &&
      !gate.actor.vendorIds.includes(assigned.order.vendorId)
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    await emitVendorActivity({
      vendorPublicId: assigned.order.vendorId,
      kind: "order",
      title: `Order ${assigned.order.orderNumber} → branch`,
      body: storeName,
      refType: "order",
      refId: assigned.order.id,
      meta: { storePublicId },
    });
    return NextResponse.json({ data: assigned.order });
  }

  const status = String(body?.status || "") as OsOrderStatus;
  if (!status) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "status or storeId required" } },
      { status: 400 },
    );
  }

  const gate = await requireVendorPermission("orders:fulfill");
  if (!gate.ok) return gate.response;

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(
    key,
    `PATCH /api/os/orders:${id}:${status}`,
    async () => {
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

      if (
        transitioned.order.vendorId &&
        !gate.actor.vendorIds.includes(transitioned.order.vendorId)
      ) {
        return {
          status: 403,
          body: {
            error: { code: "FORBIDDEN", message: "Vendor out of scope" },
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

      const order = transitioned.order;
      if (order.vendorId) {
        await emitVendorActivity({
          vendorPublicId: order.vendorId,
          kind: "order",
          title: `Order ${order.orderNumber} → ${status}`,
          body: `${order.customerName} · ${transitioned.transition.from} → ${status}`,
          refType: "order",
          refId: order.id,
          meta: { from: transitioned.transition.from, to: status },
        });
        if (
          status === "ready" ||
          status === "pending" ||
          status === "confirmed"
        ) {
          await notifyVendorStaff({
            vendorPublicId: order.vendorId,
            title: `Order ${order.orderNumber} · ${status}`,
            body: order.customerName,
            href: "/app/orders",
          });
        }
        await upsertVendorCustomerFromOrder({
          vendorPublicId: order.vendorId,
          email: order.customerEmail,
          phone: order.customerPhone,
          name: order.customerName,
          totalMinor: order.totalMinor,
          orderedAt: order.createdAt,
        });
      }

      return {
        status: 200,
        body: { data: transitioned.order, transition: transitioned.transition },
      };
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
