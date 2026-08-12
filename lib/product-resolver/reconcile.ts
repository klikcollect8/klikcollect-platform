/**
 * Reconciliation: refresh discovery confidence, probe sources, sample duplicate pairs.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { listDiscoveryCandidates } from "@/lib/product-resolver/discovery";
import { resolveBarcode } from "@/lib/product-resolver/resolve";
import { scoreMatchConfidence } from "@/lib/product-resolver/match-confidence";
import { findDuplicateProducts } from "@/lib/catalogue/duplicate-detect";
import { probeSourceHealth } from "@/lib/product-resolver/source-registry";
import { startJobRun, finishJobRun } from "@/lib/product-resolver/job-runs";

export type ReconcileSummary = {
  discoveryScored: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  duplicatePairs: number;
  sourceHealth: Array<{
    providerId: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
  }>;
  duplicates: Array<{
    discoveryId: string;
    barcode: string | null;
    matches: Array<{ publicId: string; name: string; reason: string }>;
  }>;
};

export async function runReconciliation(input?: {
  limit?: number;
  actorClerkUserId?: string | null;
  probeSources?: boolean;
}): Promise<ReconcileSummary> {
  const limit = Math.min(50, Math.max(1, input?.limit || 25));
  const jobId = await startJobRun({
    jobType: "reconcile",
    actorClerkUserId: input?.actorClerkUserId,
  });

  const summary: ReconcileSummary = {
    discoveryScored: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    duplicatePairs: 0,
    sourceHealth: [],
    duplicates: [],
  };

  try {
    if (input?.probeSources !== false) {
      const health = await probeSourceHealth();
      summary.sourceHealth = health.results;
    }

    const pending = await listDiscoveryCandidates({
      status: "pending",
      limit,
      offset: 0,
    });
    const sb = getServiceSupabase();

    for (const item of pending.items) {
      if (!item.barcode) continue;
      try {
        const resolved = await resolveBarcode({
          barcode: item.barcode,
          skipExternal: false,
        });
        const conf = scoreMatchConfidence(resolved);
        summary.discoveryScored++;
        if (conf.band === "high") summary.highConfidence++;
        else if (conf.band === "medium") summary.mediumConfidence++;
        else summary.lowConfidence++;

        await sb
          .from("product_discovery_candidates")
          .update({
            confidence_band: conf.band,
            confidence_score: conf.score,
            updated_at: new Date().toISOString(),
          })
          .eq("public_id", item.publicId);

        const matches = await findDuplicateProducts({
          barcode: item.barcode,
          name: item.name || undefined,
          brandName: item.brand,
        });
        if (matches.length) {
          summary.duplicatePairs++;
          summary.duplicates.push({
            discoveryId: item.publicId,
            barcode: item.barcode,
            matches: matches.slice(0, 3).map((m) => ({
              publicId: m.publicId,
              name: m.name,
              reason: m.reason,
            })),
          });
        }
      } catch {
        summary.lowConfidence++;
      }
    }

    await finishJobRun(jobId, { status: "ok", summary });
    return summary;
  } catch (e) {
    await finishJobRun(jobId, {
      status: "error",
      error: e instanceof Error ? e.message : "reconcile failed",
      summary,
    });
    throw e;
  }
}
