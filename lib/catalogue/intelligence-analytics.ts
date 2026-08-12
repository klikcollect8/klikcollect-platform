/**
 * Full catalogue intelligence analytics (extends Quality Centre signals).
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getQualityCentreData } from "@/lib/catalogue/quality-centre";
import { listSourceRegistry } from "@/lib/product-resolver/source-registry";
import { listJobRuns } from "@/lib/product-resolver/job-runs";
import { countDiscoveryByStatus } from "@/lib/product-resolver/discovery";

export async function getIntelligenceAnalytics() {
  const sb = getServiceSupabase();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [quality, sources, jobs, discoveryCounts, provenance, enrichAudits, scanMonth] =
    await Promise.all([
      getQualityCentreData(),
      listSourceRegistry(),
      listJobRuns({ limit: 20 }),
      countDiscoveryByStatus(),
      sb
        .from("product_field_provenance")
        .select("provider", { count: "exact", head: false })
        .limit(500),
      sb
        .from("product_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "enrichment.auto_filled")
        .gte("created_at", monthAgo),
      sb
        .from("barcode_scan_events")
        .select("resolution_status, created_at, provider_results")
        .gte("created_at", monthAgo)
        .limit(2000),
    ]);

  const provenanceByProvider = new Map<string, number>();
  for (const row of provenance.data || []) {
    const p = String(row.provider || "unknown");
    provenanceByProvider.set(p, (provenanceByProvider.get(p) || 0) + 1);
  }

  const confidenceQueue = {
    high: 0,
    medium: 0,
    low: 0,
    unscored: 0,
  };
  try {
    const { data: bands } = await sb
      .from("product_discovery_candidates")
      .select("confidence_band")
      .eq("status", "pending")
      .limit(500);
    for (const row of bands || []) {
      const b = row.confidence_band as string | null;
      if (b === "high") confidenceQueue.high++;
      else if (b === "medium") confidenceQueue.medium++;
      else if (b === "low") confidenceQueue.low++;
      else confidenceQueue.unscored++;
    }
  } catch {
    /* column may not exist yet */
  }

  const monthScans = scanMonth.data || [];
  const funnel = {
    scanned: monthScans.length,
    localFound: monthScans.filter((s) => s.resolution_status === "local_found")
      .length,
    externalFound: monthScans.filter(
      (s) => s.resolution_status === "external_found",
    ).length,
    notFound: monthScans.filter((s) => s.resolution_status === "not_found")
      .length,
    committed: monthScans.filter((s) => s.resolution_status === "committed")
      .length,
  };

  return {
    quality,
    sources,
    jobs,
    discoveryCounts,
    confidenceQueue,
    provenanceByProvider: [...provenanceByProvider.entries()].map(
      ([provider, count]) => ({ provider, count }),
    ),
    enrichmentFills30d: enrichAudits.count || 0,
    funnel30d: funnel,
    weekAgo,
  };
}
