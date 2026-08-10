import { NextRequest, NextResponse } from "next/server";
import {
  getOsOrder,
  transitionOsOrder,
  type OsOrder,
  type OsOrderStatus,
  ORDER_TRANSITIONS,
} from "@/lib/orders-store";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image";

/** Storefront-compatible projection of an OS order. */
function toLegacyOrderShape(order: OsOrder) {
  const placedAt = order.snapshot?.placedAt || order.createdAt;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    items: order.items.map((i) => ({
      product: {
        id: i.productId,
        name: i.name,
        price: i.unitPrice,
        image: i.image || PRODUCT_IMAGE_FALLBACK,
        description: i.name,
        category: "General",
        stock: 0,
        status: "published" as const,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      quantity: i.quantity,
      offerPrice: i.unitPrice,
    })),
    total: order.total,
    status: order.status,
    pickupDate: placedAt,
    pickupTime: order.collectHub || "",
    paymentStatus: "pending" as const,
    createdAt: order.createdAt,
    collectHub: order.collectHub,
    channel: order.channel,
    vendorId: order.vendorId,
    updatedAt: order.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await getOsOrder(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(toLegacyOrderShape(order));
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 },
    );
  }
}

/**
 * Platform admin status transitions via OS FSM (INV-4).
 * Lookup by public_id or order_number — never raw UUID UPDATE.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdminPermission("orders:fulfill");
    const { id } = await params;
    const body = await request.json();
    const status = String(body?.status || "") as OsOrderStatus;

    if (!status) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "status required" } },
        { status: 400 },
      );
    }

    if (!(status in ORDER_TRANSITIONS)) {
      return NextResponse.json(
        { error: { code: "INVALID", message: `Unknown status: ${status}` } },
        { status: 400 },
      );
    }

    const result = await transitionOsOrder({
      id,
      to: status,
      actorUserId: admin.user.id,
      reason: body?.reason ? String(body.reason) : "admin_control_plane",
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: { code: result.code, message: result.message },
          transition: result.transition,
        },
        { status: result.code === "NOT_FOUND" ? 404 : 409 },
      );
    }

    return NextResponse.json({
      data: toLegacyOrderShape(result.order),
      transition: result.transition,
    });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
