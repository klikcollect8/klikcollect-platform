import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("marketing:promotions", {
    vendorId,
  });
  if (!gate.ok) return gate.response;

  const supabase = getServiceSupabase();
  const vid = vendorId || gate.actor.vendorIds[0];
  const [{ data: coupons }, { data: promotions }] = await Promise.all([
    supabase
      .from("coupons")
      .select("*")
      .or(`vendor_public_id.eq.${vid},vendor_public_id.is.null`)
      .order("created_at", { ascending: false }),
    supabase
      .from("promotions")
      .select("*")
      .or(`vendor_public_id.eq.${vid},vendor_public_id.is.null`)
      .order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({
    data: { coupons: coupons || [], promotions: promotions || [] },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("marketing:coupons", { vendorId });
  if (!gate.ok) return gate.response;

  const supabase = getServiceSupabase();
  if (body?.type === "promotion") {
    const { data, error } = await supabase
      .from("promotions")
      .insert({
        title: String(body.title || "Promotion"),
        vendor_public_id: vendorId,
        status: body.status || "draft",
        rules: body.rules || {},
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    return NextResponse.json({ data });
  }

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: String(body.code || "").toUpperCase(),
      vendor_public_id: vendorId,
      percent_off: body.percentOff ?? null,
      amount_off_minor: body.amountOffMinor ?? null,
      active: true,
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  return NextResponse.json({ data });
}
