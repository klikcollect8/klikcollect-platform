import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

export async function GET(request: NextRequest) {
  const vendorPublicId =
    request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("branches:view", {
    vendorId: vendorPublicId,
  });
  if (!gate.ok) return gate.response;

  const supabase = getServiceSupabase();
  const vid = vendorPublicId || gate.actor.vendorIds[0];
  if (!vid) {
    return NextResponse.json({ data: [] });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("public_id", vid)
    .maybeSingle();

  if (!vendor) return NextResponse.json({ data: [] });

  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, public_id, name, neighbourhood, address_text, is_primary, lat, lng, manager_clerk_id, phone, pos_meta",
    )
    .eq("vendor_id", vendor.id)
    .order("is_primary", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [], vendorPublicId: vid });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorPublicId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("branches:create", {
    vendorId: vendorPublicId,
  });
  if (!gate.ok) return gate.response;

  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: { message: "name required" } },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("public_id", vendorPublicId)
    .maybeSingle();
  if (!vendor) {
    return NextResponse.json(
      { error: { message: "Vendor not found" } },
      { status: 404 },
    );
  }

  const lat = body?.lat != null && body.lat !== "" ? Number(body.lat) : null;
  const lng = body?.lng != null && body.lng !== "" ? Number(body.lng) : null;

  const { data, error } = await supabase
    .from("stores")
    .insert({
      public_id: publicId("sto"),
      vendor_id: vendor.id,
      name,
      neighbourhood: body?.neighbourhood || null,
      address_text: body?.address || null,
      is_primary: !!body?.isPrimary,
      lat: Number.isFinite(lat as number) ? lat : null,
      lng: Number.isFinite(lng as number) ? lng : null,
      phone: body?.phone || null,
      manager_clerk_id: body?.managerClerkId || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  await emitVendorActivity({
    vendorPublicId: vendorPublicId,
    kind: "system",
    title: "Branch created",
    body: name,
    refType: "store",
    refId: data.public_id,
  });
  await notifyVendorStaff({
    vendorPublicId: vendorPublicId,
    title: "Branch created",
    body: name,
    href: "/app/branches",
    roles: ["vendor_owner", "vendor_admin", "store_manager"],
  });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const vendorPublicId = String(body?.vendorId || "");
  const storeId = String(body?.id || "");
  const gate = await requireVendorPermission("branches:edit", {
    vendorId: vendorPublicId,
  });
  if (!gate.ok) return gate.response;
  if (!storeId || !vendorPublicId) {
    return NextResponse.json(
      { error: { message: "id and vendorId required" } },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("public_id", vendorPublicId)
    .maybeSingle();
  if (!vendor) {
    return NextResponse.json(
      { error: { message: "Vendor not found" } },
      { status: 404 },
    );
  }

  const { data: owned } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json(
      { error: { message: "Store not in vendor scope" } },
      { status: 403 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body?.name != null) patch.name = String(body.name);
  if (body?.address != null) patch.address_text = String(body.address);
  if (body?.neighbourhood != null)
    patch.neighbourhood = String(body.neighbourhood);
  if (body?.isPrimary != null) patch.is_primary = !!body.isPrimary;
  if (body?.phone != null) patch.phone = String(body.phone) || null;
  if (body?.managerClerkId != null) {
    patch.manager_clerk_id = String(body.managerClerkId) || null;
  }
  if (body?.lat != null && body.lat !== "") {
    const lat = Number(body.lat);
    if (Number.isFinite(lat)) patch.lat = lat;
  }
  if (body?.lng != null && body.lng !== "") {
    const lng = Number(body.lng);
    if (Number.isFinite(lng)) patch.lng = lng;
  }

  const { data, error } = await supabase
    .from("stores")
    .update(patch)
    .eq("id", storeId)
    .eq("vendor_id", vendor.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  await emitVendorActivity({
    vendorPublicId: vendorPublicId,
    kind: "system",
    title: "Branch updated",
    body: String(data.name || storeId),
    refType: "store",
    refId: data.public_id || storeId,
  });
  return NextResponse.json({ data });
}
