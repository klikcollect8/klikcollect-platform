import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";
import { checkCoordinate, isInKenyaBbox } from "@/lib/location/validate";

/**
 * Validate optional branch coordinates. Returns:
 * - { ok: true, lat, lng }         valid coordinate pair
 * - { ok: true, lat: null, ... }   no coordinates supplied
 * - { ok: false, response }        rejected (422)
 */
function parseBranchCoords(body: Record<string, unknown>):
  | { ok: true; lat: number | null; lng: number | null }
  | { ok: false; response: NextResponse } {
  const rawLat = body?.lat;
  const rawLng = body?.lng;
  const hasLat = rawLat != null && rawLat !== "";
  const hasLng = rawLng != null && rawLng !== "";
  if (!hasLat && !hasLng) return { ok: true, lat: null, lng: null };
  if (hasLat !== hasLng) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "INVALID_COORDINATES",
            message: "Provide both latitude and longitude",
          },
        },
        { status: 422 },
      ),
    };
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const check = checkCoordinate(lat, lng);
  if (!check.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "INVALID_COORDINATES",
            message:
              check.reason === "suspicious"
                ? "These coordinates look like a placeholder (0,0 or default centre). Drop the pin on the actual branch."
                : "Branch coordinates are out of range",
            reason: check.reason,
          },
        },
        { status: 422 },
      ),
    };
  }
  if (!isInKenyaBbox(lat, lng)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "OUTSIDE_KENYA",
            message: "Branch coordinates must be inside Kenya",
            reason: "outside_kenya",
          },
        },
        { status: 422 },
      ),
    };
  }
  return { ok: true, lat, lng };
}

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
      "id, public_id, name, neighbourhood, address_text, is_primary, lat, lng, manager_clerk_id, phone, pos_meta, place_id, location_verified, location_confidence, location_updated_at",
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

  const coords = parseBranchCoords(body);
  if (!coords.ok) return coords.response;

  const { data, error } = await supabase
    .from("stores")
    .insert({
      public_id: publicId("sto"),
      vendor_id: vendor.id,
      name,
      neighbourhood: body?.neighbourhood || null,
      address_text: body?.address || null,
      is_primary: !!body?.isPrimary,
      lat: coords.lat,
      lng: coords.lng,
      phone: body?.phone || null,
      manager_clerk_id: body?.managerClerkId || null,
      place_id: body?.placeId ? String(body.placeId).slice(0, 120) : null,
      location_verified: !!body?.locationVerified && coords.lat != null,
      location_confidence: body?.locationConfidence
        ? String(body.locationConfidence).slice(0, 32)
        : null,
      location_updated_at: coords.lat != null ? new Date().toISOString() : null,
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
  if (body?.clearLocation === true) {
    // Explicit removal of a bad pin — never silently, only on request.
    patch.lat = null;
    patch.lng = null;
    patch.place_id = null;
    patch.location_verified = false;
    patch.location_confidence = null;
    patch.location_updated_at = new Date().toISOString();
  } else {
    const coords = parseBranchCoords(body);
    if (!coords.ok) return coords.response;
    if (coords.lat != null && coords.lng != null) {
      patch.lat = coords.lat;
      patch.lng = coords.lng;
      patch.location_updated_at = new Date().toISOString();
    }
    if (body?.placeId != null) {
      patch.place_id = body.placeId ? String(body.placeId).slice(0, 120) : null;
    }
    if (body?.locationVerified != null) {
      patch.location_verified = !!body.locationVerified;
    }
    if (body?.locationConfidence != null) {
      patch.location_confidence = body.locationConfidence
        ? String(body.locationConfidence).slice(0, 32)
        : null;
    }
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
