import { NextResponse } from "next/server";
import { requireClerkUser } from "@/lib/auth/require-clerk-user";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { distanceMeters, isValidLatLng } from "@/lib/location/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXTS = new Set(["checkout", "saved_location", "vendor_branch"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

/**
 * Best-effort pin-correction signal (provider geocode vs user-corrected pin).
 * Always answers ok — this endpoint must never break a checkout or editor
 * flow. Signed-out corrections are accepted without an actor.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return NextResponse.json({ ok: true });

    const context = String(body.context || "");
    const providerLat = Number(body.providerLat);
    const providerLng = Number(body.providerLng);
    const correctedLat = Number(body.correctedLat);
    const correctedLng = Number(body.correctedLng);

    if (
      !CONTEXTS.has(context) ||
      !isValidLatLng(providerLat, providerLng) ||
      !isValidLatLng(correctedLat, correctedLng)
    ) {
      return NextResponse.json({ ok: true });
    }

    // Recompute server-side; never trust the client's distance.
    const distanceM = distanceMeters(
      providerLat,
      providerLng,
      correctedLat,
      correctedLng,
    );
    if (!Number.isFinite(distanceM) || distanceM < 10 || distanceM > 100_000) {
      return NextResponse.json({ ok: true });
    }

    const actor = await requireClerkUser().catch(() => null);
    const storeId =
      typeof body.storeId === "string" && UUID_RE.test(body.storeId)
        ? body.storeId
        : null;

    const sb = getServiceSupabase();
    await sb.from("location_corrections").insert({
      context,
      provider_lat: providerLat,
      provider_lng: providerLng,
      corrected_lat: correctedLat,
      corrected_lng: correctedLng,
      provider_label: body.providerLabel
        ? String(body.providerLabel).slice(0, 300)
        : null,
      place_id: body.placeId ? String(body.placeId).slice(0, 120) : null,
      distance_m: Math.round(distanceM),
      clerk_user_id: actor?.userId ?? null,
      store_id: storeId,
    });
  } catch {
    /* best effort — never surface errors to the caller */
  }
  return NextResponse.json({ ok: true });
}
