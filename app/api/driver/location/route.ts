import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { hasPermission } from "@/lib/authz/can";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { unauthorizedJson, forbiddenJson } from "@/lib/auth/require-clerk-user";

function canDriver(actor: Awaited<ReturnType<typeof resolveActor>>) {
  return (
    hasPermission(actor, "delivery:view") ||
    hasPermission(actor, "delivery:complete") ||
    hasPermission(actor, "delivery:track")
  );
}

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorizedJson();
  const actor = await resolveActor(user);
  if (!canDriver(actor)) return forbiddenJson("Driver permission required");

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("clerk_user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ data: data || null });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorizedJson();
  const actor = await resolveActor(user);
  if (!canDriver(actor)) return forbiddenJson("Driver permission required");

  const body = await request.json();
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const online = body?.online === undefined ? true : Boolean(body.online);
  const heading =
    body?.heading != null && Number.isFinite(Number(body.heading))
      ? Number(body.heading)
      : null;
  const accuracy =
    body?.accuracy != null && Number.isFinite(Number(body.accuracy))
      ? Number(body.accuracy)
      : null;
  const activeDeliveryId = body?.activeDeliveryId
    ? String(body.activeDeliveryId)
    : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: { message: "lat and lng required" } },
      { status: 400 },
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: { message: "Invalid coordinates" } },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("driver_locations")
    .upsert(
      {
        clerk_user_id: user.id,
        lat,
        lng,
        heading,
        online,
        accuracy_m: accuracy,
        active_delivery_id: activeDeliveryId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" },
    )
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
