import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import {
  FeatureUnavailableError,
  isMissingRelationError,
} from "@/lib/offers-mutations";

export type ContentReportTarget = "review" | "question";
export type ContentReportStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed";

export async function createContentReport(input: {
  vendorPublicId: string;
  actorClerkId: string;
  targetType: ContentReportTarget;
  targetId: string;
  reason?: string;
  message?: string;
}): Promise<{ publicId: string }> {
  const sb = getServiceSupabase();
  const id = publicId("crp");
  const { error } = await sb.from("content_reports").insert({
    public_id: id,
    vendor_public_id: input.vendorPublicId,
    actor_clerk_id: input.actorClerkId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason || "other",
    message: input.message || "",
    status: "open",
  });
  if (error) {
    if (isMissingRelationError(error)) {
      throw new FeatureUnavailableError(
        "Content reports are not available yet (migration pending)",
      );
    }
    throw error;
  }
  return { publicId: id };
}

export async function getContentReportByPublicId(
  publicIdValue: string,
): Promise<Record<string, unknown> | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("content_reports")
    .select("*")
    .eq("public_id", publicIdValue)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) {
      throw new FeatureUnavailableError(
        "Content reports are not available yet (migration pending)",
      );
    }
    throw error;
  }
  return (data as Record<string, unknown>) || null;
}

export async function listContentReports(opts?: {
  status?: string;
  limit?: number;
}) {
  const sb = getServiceSupabase();
  let q = sb
    .from("content_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return data || [];
}

export async function updateContentReport(input: {
  publicId: string;
  status: ContentReportStatus;
  adminNotes?: string | null;
  resolvedByClerkId?: string;
}): Promise<Record<string, unknown> | null> {
  const sb = getServiceSupabase();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.adminNotes !== undefined) patch.admin_notes = input.adminNotes;
  if (input.status === "resolved" || input.status === "dismissed") {
    patch.resolved_at = new Date().toISOString();
    if (input.resolvedByClerkId) {
      patch.resolved_by_clerk_id = input.resolvedByClerkId;
    }
  }
  const { data, error } = await sb
    .from("content_reports")
    .update(patch)
    .eq("public_id", input.publicId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown>) || null;
}

export async function countOpenContentReports(): Promise<number> {
  const sb = getServiceSupabase();
  const { count, error } = await sb
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) {
    if (isMissingRelationError(error)) return 0;
    throw error;
  }
  return count ?? 0;
}
