import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope } from "@/lib/auth/vendor-scope";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId") || undefined;
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("products:view", { vendorId });
  if (!gate.ok) return gate.response;

  const sb = getServiceSupabase();
  let q = sb
    .from("product_variants")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (productId) q = q.eq("product_public_id", productId);
  if (vendorId) {
    if (!inVendorScope(gate.actor, vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    q = q.eq("vendor_public_id", vendorId);
  } else {
    q = q.in("vendor_public_id", gate.actor.vendorIds);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}

/** Variants are platform catalogue data — vendors cannot mutate. */
export async function PUT() {
  return NextResponse.json(
    {
      error: {
        message:
          "Canonical variants are managed by KlikCollect. Update your offer price/stock instead.",
      },
    },
    { status: 403 },
  );
}
