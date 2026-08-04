import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdminPermission("api:keys");
    const { data } = await getServiceSupabase()
      .from("api_keys")
      .select("id, name, key_prefix, scopes, revoked_at, created_at")
      .order("created_at", { ascending: false });
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminPermission("api:manage");
    const body = await request.json();
    const name = String(body?.name || "Integration key").trim();
    const secret = `kc_${crypto.randomBytes(24).toString("hex")}`;
    const prefix = secret.slice(0, 10);
    const hash = crypto.createHash("sha256").update(secret).digest("hex");

    const { data, error } = await getServiceSupabase()
      .from("api_keys")
      .insert({
        name,
        key_prefix: prefix,
        key_hash: hash,
        scopes: body?.scopes || ["read"],
        created_by_clerk_user_id: gate.user.id,
      })
      .select("id, name, key_prefix, created_at")
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ...data, secret } });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminPermission("api:manage");
    const body = await request.json();
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const { data, error } = await getServiceSupabase()
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, key_prefix, revoked_at")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}
