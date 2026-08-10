import { NextRequest, NextResponse } from "next/server";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";
import { listOffers, listOffersForProduct } from "@/lib/offers-store";
import { getServiceSupabase } from "@/lib/supabase/admin";

/** Platform view of vendor offers (optional product filter). */
export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("offers:view");
    const productId = request.nextUrl.searchParams.get("productId");
    const data = productId
      ? await listOffersForProduct(productId)
      : (await listOffers()).slice(0, 500);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

/** Suspend / restore an offer. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdminPermission("offers:availability");
    const body = await request.json();
    const offerId = String(body?.offerId || "");
    const status = String(body?.status || "");
    if (!offerId || !["published", "draft", "archived"].includes(status)) {
      return NextResponse.json(
        { error: { message: "offerId and status required" } },
        { status: 400 },
      );
    }
    const sb = getServiceSupabase();
    const { data, error } = await sb
      .from("product_offers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("public_id", offerId)
      .select("public_id, status, price_minor, on_hand")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }
    return NextResponse.json({ data });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
