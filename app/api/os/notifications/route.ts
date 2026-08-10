import { NextRequest, NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireVendorActor();
  if (!gate.ok) {
    // Still allow platform-less customers? OS notifications are vendor panel —
    // fall back to clerk user scoped rows for any signed-in user with membership.
    return gate.response;
  }

  const { data, error } = await getServiceSupabase()
    .from("panel_notifications")
    .select("*")
    .eq("clerk_user_id", gate.actor.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json(
      { error: { message: "id required" } },
      { status: 400 },
    );
  }

  const { data, error } = await getServiceSupabase()
    .from("panel_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clerk_user_id", gate.actor.userId)
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

export async function POST(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json(
      { error: { message: "title required" } },
      { status: 400 },
    );
  }

  const { data, error } = await getServiceSupabase()
    .from("panel_notifications")
    .insert({
      clerk_user_id: gate.actor.userId,
      title,
      body: body?.body || null,
      href: body?.href || null,
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
