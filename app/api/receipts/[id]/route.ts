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

  let vendorName: string | null = null;
  const vendorPublicId = receipt.vendor_public_id
    ? String(receipt.vendor_public_id)
    : "";
  if (vendorPublicId) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("name")
      .eq("public_id", vendorPublicId)
      .maybeSingle();
    vendorName = vendor?.name ? String(vendor.name) : null;
  }

  const rawLines = Array.isArray(receipt.line_items) ? receipt.line_items : [];
  const lines = rawLines.map((it: Record<string, unknown>) => ({
    name: String(it.name || it.product_name || "Item"),
    quantity: Number(it.quantity || 1),
    moneyMinor:
      typeof it.money_minor === "number"
        ? it.money_minor
        : typeof it.moneyMinor === "number"
          ? it.moneyMinor
          : undefined,
  }));

  return NextResponse.json({
    data: {
      ...receipt,
      vendor_name: vendorName,
      lines,
      auth_required: true,
    },
  });
}
