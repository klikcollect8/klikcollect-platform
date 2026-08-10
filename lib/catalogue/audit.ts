import { getServiceSupabase } from "@/lib/supabase/admin";

export async function writeProductAudit(input: {
  productPublicId: string;
  actorClerkUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}): Promise<void> {
  try {
    const sb = getServiceSupabase();
    await sb.from("product_audit_log").insert({
      product_public_id: input.productPublicId,
      actor_clerk_user_id: input.actorClerkUserId || null,
      actor_email: input.actorEmail || null,
      action: input.action,
      before_state: input.before ?? null,
      after_state: input.after ?? null,
      reason: input.reason || null,
    });
  } catch (err) {
    console.error("[product_audit_log]", err);
  }
}
