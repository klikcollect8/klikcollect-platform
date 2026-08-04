import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;

  const scope = vendorId || gate.actor.vendorIds[0];
  const { data } = await getServiceSupabase()
    .from("kyc_submissions")
    .select("*")
    .eq("vendor_public_id", scope)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ data: data || [], vendorId: scope });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;

  const legalName = String(body?.legalName || body?.businessName || "").trim();
  if (!legalName) {
    return NextResponse.json(
      { error: { message: "legalName required" } },
      { status: 400 },
    );
  }

  const { data, error } = await getServiceSupabase()
    .from("kyc_submissions")
    .insert({
      vendor_public_id: vendorId,
      status: "pending",
      legal_name: legalName,
      registration_number: body?.registrationNumber || null,
      documents: body?.documents || {},
      notes: body?.notes || null,
      payouts_frozen: false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}
