import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { listCatalogue } from "@/lib/catalogue-store";
import { availableOf } from "@/lib/inventory";

/** List this vendor's offers (flattened catalogue rows). */
export async function GET(request: NextRequest) {
  const gate = await requireVendorPermission("offers:view");
  if (!gate.ok) return gate.response;

  const vendorId =
    request.nextUrl.searchParams.get("vendorId") ||
    gate.actor.vendorIds[0] ||
    "";
  if (!vendorId || !gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const rows = await listCatalogue(vendorId);
  return NextResponse.json({
    data: rows.map((p) => ({
      ...p,
      available: availableOf(p),
      onHand: p.onHand ?? p.stock,
      reserved: p.reserved ?? 0,
    })),
  });
}
