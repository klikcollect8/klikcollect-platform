import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { hasPermission } from "@/lib/authz/can";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { unauthorizedJson, forbiddenJson } from "@/lib/auth/require-clerk-user";

const ALLOWED_STATUS = new Set([
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
]);

function canView(actor: Awaited<ReturnType<typeof resolveActor>>) {
  return (
    hasPermission(actor, "delivery:view") ||
    hasPermission(actor, "delivery:complete")
  );
}

function canMutate(actor: Awaited<ReturnType<typeof resolveActor>>) {
  return (
    hasPermission(actor, "delivery:view") ||
    hasPermission(actor, "delivery:complete") ||
    hasPermission(actor, "delivery:pod") ||
    hasPermission(actor, "barcode:scan")
  );
}

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorizedJson();
  const actor = await resolveActor(user);
  if (!canView(actor)) return forbiddenJson("Driver permission required");

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_clerk_user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorizedJson();
  const actor = await resolveActor(user);
  if (!canMutate(actor)) return forbiddenJson("Missing delivery permission");

  const body = await request.json();
  const id = String(body?.id || "");
  const barcode = body?.barcode ? String(body.barcode).trim() : "";
  const statusRaw = body?.status != null ? String(body.status) : "";
  const otp = body?.otp != null ? String(body.otp) : null;
  const lat =
    body?.lat != null && Number.isFinite(Number(body.lat))
      ? Number(body.lat)
      : null;
  const lng =
    body?.lng != null && Number.isFinite(Number(body.lng))
      ? Number(body.lng)
      : null;

  if (statusRaw && !ALLOWED_STATUS.has(statusRaw)) {
    return NextResponse.json(
      { error: { message: "Invalid status" } },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();

  let row: {
    id: string;
    driver_clerk_user_id: string | null;
    otp_code: string | null;
    pod: unknown;
    status: string;
    completed_at: string | null;
    lat: number | null;
    lng: number | null;
  } | null = null;

  if (id) {
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    row = data;
  } else if (barcode) {
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .eq("driver_clerk_user_id", user.id)
      .eq("public_id", barcode)
      .maybeSingle();
    row = data;
  }

  if (!row || row.driver_clerk_user_id !== user.id) {
    return forbiddenJson("Not your delivery");
  }

  const nextStatus = statusRaw || row.status;

  if (nextStatus === "delivered") {
    if (
      !hasPermission(actor, "delivery:complete") &&
      !hasPermission(actor, "delivery:pod")
    ) {
      return forbiddenJson("Missing delivery complete permission");
    }
    if (row.otp_code && otp !== row.otp_code) {
      return NextResponse.json(
        { error: { message: "Invalid OTP" } },
        { status: 400 },
      );
    }
  }

  const existingPod =
    typeof row.pod === "object" && row.pod
      ? (row.pod as Record<string, unknown>)
      : {};
  const incoming =
    body?.pod && typeof body.pod === "object"
      ? (body.pod as Record<string, unknown>)
      : null;
  const photo =
    (incoming?.photoUrl as string | undefined) ||
    (incoming?.photoDataUrl as string | undefined) ||
    (existingPod.photoUrl as string | undefined) ||
    (existingPod.photoDataUrl as string | undefined);
  const signature =
    (incoming?.signatureUrl as string | undefined) ||
    (incoming?.signatureDataUrl as string | undefined) ||
    (existingPod.signatureUrl as string | undefined) ||
    (existingPod.signatureDataUrl as string | undefined);
  const pod = incoming
    ? {
        ...existingPod,
        ...incoming,
        photoUrl: photo || null,
        photoDataUrl: photo || null,
        signatureUrl: signature || null,
        signatureDataUrl: signature || null,
        completedBy: user.id,
      }
    : existingPod;

  const patch: Record<string, unknown> = {
    status: nextStatus,
    pod,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus === "delivered") {
    patch.completed_at = new Date().toISOString();
  }
  if (lat != null && lng != null) {
    patch.lat = lat;
    patch.lng = lng;
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update(patch)
    .eq("id", row.id)
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
