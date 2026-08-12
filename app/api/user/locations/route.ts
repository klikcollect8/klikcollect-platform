import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { checkCoordinate } from "@/lib/location/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOCATIONS = 30;

type DbRow = {
  id: string;
  name: string;
  label: string;
  delivery_lat: number;
  delivery_lng: number;
  address_lat: number | null;
  address_lng: number | null;
  formatted_address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  street: string | null;
  neighbourhood: string | null;
  estate: string | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  landmark: string | null;
  instructions: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  postal_code: string | null;
  place_id: string | null;
  source: string;
  confidence: string;
  verification: string;
  is_default: boolean;
  last_used_at: string | null;
  created_at: string;
};

function toClient(row: DbRow) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    lat: row.delivery_lat,
    lng: row.delivery_lng,
    addressLat: row.address_lat,
    addressLng: row.address_lng,
    formattedAddress: row.formatted_address || "",
    addressLine1: row.address_line1 || undefined,
    addressLine2: row.address_line2 || undefined,
    street: row.street || undefined,
    neighbourhood: row.neighbourhood || undefined,
    estate: row.estate || undefined,
    building: row.building || undefined,
    floor: row.floor || undefined,
    unit: row.unit || undefined,
    landmark: row.landmark || undefined,
    instructions: row.instructions || undefined,
    city: row.city || undefined,
    county: row.county || undefined,
    country: row.country || "KE",
    postalCode: row.postal_code || undefined,
    placeId: row.place_id,
    source: row.source,
    confidence: row.confidence,
    verification: row.verification,
    isDefault: row.is_default,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function str(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

const SOURCES = new Set(["mapbox", "gps", "manual", "seed", "unknown"]);
const CONFIDENCES = new Set([
  "high",
  "medium",
  "low",
  "user_pinned",
  "gps_verified",
  "provider_resolved",
  "manual",
]);
const VERIFICATIONS = new Set([
  "unverified",
  "user_pinned",
  "gps_verified",
  "admin_verified",
]);

function parseBody(body: Record<string, unknown>, requireCoords: boolean) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasCoords = body.lat != null || body.lng != null;

  if (requireCoords || hasCoords) {
    const check = checkCoordinate(lat, lng);
    if (!check.ok) {
      return { error: `Invalid coordinates (${check.reason})` };
    }
  }

  const label =
    body.label === "home" || body.label === "work" ? body.label : "other";

  const fields: Record<string, unknown> = {};
  if (hasCoords) {
    fields.delivery_lat = lat;
    fields.delivery_lng = lng;
  }
  const addressLat = Number(body.addressLat);
  const addressLng = Number(body.addressLng);
  if (
    body.addressLat != null &&
    body.addressLng != null &&
    checkCoordinate(addressLat, addressLng).ok
  ) {
    fields.address_lat = addressLat;
    fields.address_lng = addressLng;
  }
  if (body.name !== undefined) fields.name = str(body.name, 80) || "Saved location";
  if (body.label !== undefined) fields.label = label;
  if (body.formattedAddress !== undefined)
    fields.formatted_address = str(body.formattedAddress);
  if (body.addressLine1 !== undefined) fields.address_line1 = str(body.addressLine1);
  if (body.addressLine2 !== undefined) fields.address_line2 = str(body.addressLine2);
  if (body.street !== undefined) fields.street = str(body.street);
  if (body.neighbourhood !== undefined) fields.neighbourhood = str(body.neighbourhood);
  if (body.estate !== undefined) fields.estate = str(body.estate);
  if (body.building !== undefined) fields.building = str(body.building);
  if (body.floor !== undefined) fields.floor = str(body.floor, 40);
  if (body.unit !== undefined) fields.unit = str(body.unit, 40);
  if (body.landmark !== undefined) fields.landmark = str(body.landmark);
  if (body.instructions !== undefined) fields.instructions = str(body.instructions, 500);
  if (body.city !== undefined) fields.city = str(body.city, 80);
  if (body.county !== undefined) fields.county = str(body.county, 80);
  if (body.country !== undefined) fields.country = str(body.country, 8) || "KE";
  if (body.postalCode !== undefined) fields.postal_code = str(body.postalCode, 20);
  if (body.placeId !== undefined) fields.place_id = str(body.placeId, 120);
  if (typeof body.source === "string" && SOURCES.has(body.source)) {
    fields.source = body.source;
  }
  if (typeof body.confidence === "string" && CONFIDENCES.has(body.confidence)) {
    fields.confidence = body.confidence;
  }
  if (
    typeof body.verification === "string" &&
    VERIFICATIONS.has(body.verification)
  ) {
    fields.verification = body.verification;
  }
  if (body.isDefault !== undefined) fields.is_default = body.isDefault === true;
  if (typeof body.lastUsedAt === "number" && Number.isFinite(body.lastUsedAt)) {
    fields.last_used_at = new Date(body.lastUsedAt).toISOString();
  }

  return { fields };
}

export async function GET() {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("user_saved_locations")
    .select("*")
    .eq("clerk_user_id", actor.userId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(MAX_LOCATIONS);

  if (error) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({
    locations: ((data || []) as DbRow[]).map(toClient),
  });
}

export async function POST(req: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseBody(body, true);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: { code: "INVALID_COORDINATES", message: parsed.error } },
      { status: 422 },
    );
  }
  if (parsed.fields.delivery_lat == null) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_COORDINATES",
          message: "A delivery pin (lat/lng) is required",
        },
      },
      { status: 422 },
    );
  }

  const sb = getServiceSupabase();

  const { count } = await sb
    .from("user_saved_locations")
    .select("id", { count: "exact", head: true })
    .eq("clerk_user_id", actor.userId);
  if ((count ?? 0) >= MAX_LOCATIONS) {
    return NextResponse.json(
      {
        error: {
          code: "LIMIT_REACHED",
          message: `You can save up to ${MAX_LOCATIONS} locations`,
        },
      },
      { status: 409 },
    );
  }

  if (parsed.fields.is_default === true) {
    await sb
      .from("user_saved_locations")
      .update({ is_default: false })
      .eq("clerk_user_id", actor.userId);
  }

  const { data, error } = await sb
    .from("user_saved_locations")
    .insert({ ...parsed.fields, clerk_user_id: actor.userId })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ location: toClient(data as DbRow) });
}

export async function PATCH(req: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = str(body.id, 80);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    return NextResponse.json(
      { error: { code: "MISSING_ID", message: "Valid location id required" } },
      { status: 400 },
    );
  }

  const parsed = parseBody(body, false);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: { code: "INVALID_COORDINATES", message: parsed.error } },
      { status: 422 },
    );
  }
  if (!Object.keys(parsed.fields).length) {
    return NextResponse.json(
      { error: { code: "NO_FIELDS", message: "Nothing to update" } },
      { status: 400 },
    );
  }

  const sb = getServiceSupabase();

  if (parsed.fields.is_default === true) {
    await sb
      .from("user_saved_locations")
      .update({ is_default: false })
      .eq("clerk_user_id", actor.userId);
  }

  const { data, error } = await sb
    .from("user_saved_locations")
    .update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clerk_user_id", actor.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Location not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ location: toClient(data as DbRow) });
}

export async function DELETE(req: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: { code: "MISSING_ID", message: "Location id required" } },
      { status: 400 },
    );
  }
  // Local-only ids never existed in the DB — nothing to delete server-side.
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    return NextResponse.json({ ok: true });
  }

  const sb = getServiceSupabase();
  const { error } = await sb
    .from("user_saved_locations")
    .delete()
    .eq("id", id)
    .eq("clerk_user_id", actor.userId);

  if (error) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
