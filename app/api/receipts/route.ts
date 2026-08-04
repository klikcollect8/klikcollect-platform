import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { unauthorizedJson } from "@/lib/auth/require-clerk-user";

/** Lookup receipt by Paystack reference or list recent for user */
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorizedJson();

  const reference = request.nextUrl.searchParams.get("reference");
  const supabase = getServiceSupabase();
  const actor = await resolveActor(user);
  const isStaff = actor.isPlatformStaff || actor.isSuperAdmin;

  if (reference) {
    const { data: receipt, error } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (error || !receipt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (receipt.clerk_user_id !== user.id && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: receipt });
  }

  const { data } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("clerk_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return NextResponse.json({ data: data || [] });
}
