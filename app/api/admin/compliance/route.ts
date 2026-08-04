import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdminPermission("compliance:kyc_review");
    const supabase = getServiceSupabase();
    const { data: submissions } = await supabase
      .from("kyc_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const { data: audit } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({
      data: { submissions: submissions || [], audit: audit || [] },
    });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminPermission("compliance:kyc_review");
    const body = await request.json();
    const action = String(body?.action || "");
    const id = String(body?.id || "");
    const supabase = getServiceSupabase();

    if (action === "review") {
      const status = String(body?.status || "");
      if (!["approved", "rejected", "needs_info"].includes(status) || !id) {
        return NextResponse.json({ error: "Invalid review" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("kyc_submissions")
        .update({
          status,
          notes: body?.notes || null,
          reviewed_by_clerk_user_id: gate.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("audit_log").insert({
        actor_clerk_user_id: gate.user.id,
        action: `kyc.${status}`,
        resource_type: "kyc_submission",
        resource_id: id,
        metadata: { status },
      });
      return NextResponse.json({ data });
    }

    if (action === "freeze_payouts") {
      await requireAdminPermission("payments:freeze_payouts");
      const vendorPublicId = String(body?.vendorPublicId || "");
      const frozen = Boolean(body?.frozen);
      if (!vendorPublicId) {
        return NextResponse.json(
          { error: "vendorPublicId required" },
          { status: 400 },
        );
      }
      const { data: existing } = await supabase
        .from("kyc_submissions")
        .select("id")
        .eq("vendor_public_id", vendorPublicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let data;
      if (existing?.id) {
        const res = await supabase
          .from("kyc_submissions")
          .update({
            payouts_frozen: frozen,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        data = res.data;
      } else {
        const res = await supabase
          .from("kyc_submissions")
          .insert({
            vendor_public_id: vendorPublicId,
            status: "pending",
            payouts_frozen: frozen,
            legal_name: vendorPublicId,
          })
          .select("*")
          .single();
        data = res.data;
      }

      await supabase.from("audit_log").insert({
        actor_clerk_user_id: gate.user.id,
        action: frozen ? "payouts.freeze" : "payouts.unfreeze",
        resource_type: "vendor",
        resource_id: vendorPublicId,
        metadata: {},
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}
