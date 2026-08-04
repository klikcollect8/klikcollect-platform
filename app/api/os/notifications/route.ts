import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { unauthorizedJson } from "@/lib/auth/require-clerk-user";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorizedJson();

  const { data, error } = await getServiceSupabase()
    .from("panel_notifications")
    .select("*")
    .eq("clerk_user_id", user.id)
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
  const user = await currentUser();
  if (!user) return unauthorizedJson();
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
    .eq("clerk_user_id", user.id)
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
  const user = await currentUser();
  if (!user) return unauthorizedJson();
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
      clerk_user_id: user.id,
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
