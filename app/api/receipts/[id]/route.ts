import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { unauthorizedJson } from "@/lib/auth/require-clerk-user";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await currentUser();
  if (!user) return unauthorizedJson();

  const supabase = getServiceSupabase();
  const { data: receipt, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("public_id", id)
    .maybeSingle();

  if (error || !receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = await resolveActor(user);
  const owns = receipt.clerk_user_id === user.id;
  const isStaff = actor.isPlatformStaff || actor.isSuperAdmin;

  if (!owns && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: receipt });
}
