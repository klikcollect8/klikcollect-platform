import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import type { Permission } from "@/lib/authz/permissions";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("warehouse:inventory", {
    vendorId,
  });
  if (!gate.ok) return gate.response;

  let q = getServiceSupabase()
    .from("warehouse_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!gate.actor.vendorIds.length) {
    return NextResponse.json({ data: [] });
  }
  q = q.in("vendor_public_id", gate.actor.vendorIds);
  if (vendorId) {
    if (!gate.actor.vendorIds.includes(vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    q = q.eq("vendor_public_id", vendorId);
  }

  const { data, error } = await q;
  if (error)
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const type = String(body?.type || "pick");
  const perm: Permission =
    type === "pack"
      ? "warehouse:packing"
      : type === "receive"
        ? "warehouse:receiving"
        : "warehouse:picking";

  const gate = await requireVendorPermission(perm, { vendorId });
  if (!gate.ok) return gate.response;

  if (body?.action === "complete") {
    const { data, error } = await getServiceSupabase()
      .from("warehouse_tasks")
      .update({
        status: "done",
        assignee_clerk_user_id: gate.actor.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error)
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    return NextResponse.json({ data });
  }

  const { data, error } = await getServiceSupabase()
    .from("warehouse_tasks")
    .insert({
      public_id: publicId("wht"),
      vendor_public_id: vendorId,
      order_public_id: body.orderPublicId || null,
      type,
      status: "open",
      payload: body.payload || {},
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
