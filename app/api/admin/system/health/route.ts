import { NextResponse } from "next/server";
import { requireAdmin, handleRequireAdminError } from "@/lib/auth/require-admin";
import { listCatalogue } from "@/lib/catalogue-store";
import { listOsOrders } from "@/lib/orders-store";

export async function GET() {
  try {
    await requireAdmin();
    const [catalogue, orders] = await Promise.all([listCatalogue(), listOsOrders()]);
    return NextResponse.json({
      ok: true,
      catalogueCount: catalogue.length,
      ordersCount: orders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
