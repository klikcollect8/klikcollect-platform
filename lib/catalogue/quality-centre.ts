import { getServiceSupabase } from "@/lib/supabase/admin";
import { findDuplicateProducts } from "@/lib/catalogue/duplicate-detect";
import { listDiscoveryCandidates } from "@/lib/product-resolver/discovery";

export type QualityCentrePayload = {
  kpis: {
    products: number;
    missingBarcode: number;
    missingImage: number;
    failedLookups24h: number;
    scansToday: number;
    successfulMatchesToday: number;
    pendingDiscovery: number;
  };
  failedLookups: Array<{
    barcode: string;
    format: string | null;
    resolutionStatus: string;
    createdAt: string;
    attempts: number;
  }>;
  missingBarcodes: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  }>;
  incomplete: Array<{
    id: string;
    name: string;
    status: string;
    issues: string[];
  }>;
  duplicates: Array<{
    publicId: string;
    name: string;
    barcode: string | null;
    reason: string;
  }>;
  lowConfidenceDiscovery: Array<{
    publicId: string;
    name: string | null;
    barcode: string | null;
    provider: string;
    completeness: number | null;
  }>;
  analytics: {
    scansByStatus: Array<{ key: string; label: string; value: number }>;
    topBarcodes: Array<{ barcode: string; count: number }>;
    providerHits: Array<{ provider: string; hits: number; misses: number }>;
    scansSeries: Array<{ day: string; value: number }>;
  };
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export async function getQualityCentreData(): Promise<QualityCentrePayload> {
  const sb = getServiceSupabase();
  const today = startOfTodayIso();
  const dayAgo = daysAgoIso(1);
  const weekAgo = daysAgoIso(7);

  const [
    productsCount,
    missingBarcode,
    missingImage,
    scansToday,
    failed24,
    discovery,
    recentFailed,
    missingBarcodeRows,
    incompleteRows,
    weekScans,
  ] = await Promise.all([
    sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("barcode", null),
    sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("image_url", null),
    sb
      .from("barcode_scan_events")
      .select("id, resolution_status", { count: "exact" })
      .gte("created_at", today)
      .limit(500),
    sb
      .from("barcode_scan_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo)
      .in("resolution_status", ["not_found", "error", "invalid"]),
    listDiscoveryCandidates({ status: "pending", limit: 40 }),
    sb
      .from("barcode_scan_events")
      .select("barcode, format, resolution_status, created_at, provider_results")
      .in("resolution_status", ["not_found", "error", "invalid"])
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("products")
      .select("public_id, name, status, updated_at")
      .is("deleted_at", null)
      .is("barcode", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    sb
      .from("products")
      .select(
        "public_id, name, status, barcode, image_url, description, brand_id, category_id, updated_at",
      )
      .is("deleted_at", null)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(80),
    sb
      .from("barcode_scan_events")
      .select("barcode, resolution_status, created_at, provider_results")
      .gte("created_at", weekAgo)
      .limit(2000),
  ]);

  const scanRows = scansToday.data || [];
  const successfulMatchesToday = scanRows.filter((r) =>
    ["local_found", "external_found", "committed"].includes(
      String(r.resolution_status),
    ),
  ).length;

  const failedMap = new Map<
    string,
    {
      barcode: string;
      format: string | null;
      resolutionStatus: string;
      createdAt: string;
      attempts: number;
    }
  >();
  for (const row of recentFailed.data || []) {
    const b = String(row.barcode || "");
    if (!b) continue;
    const prev = failedMap.get(b);
    if (prev) {
      prev.attempts += 1;
      continue;
    }
    failedMap.set(b, {
      barcode: b,
      format: (row.format as string) || null,
      resolutionStatus: String(row.resolution_status),
      createdAt: String(row.created_at),
      attempts: 1,
    });
  }

  const incomplete = (incompleteRows.data || [])
    .map((row) => {
      const issues: string[] = [];
      if (!row.barcode) issues.push("barcode");
      if (!row.image_url) issues.push("image");
      if (!row.description || String(row.description).length < 8)
        issues.push("description");
      if (!row.brand_id) issues.push("brand");
      if (!row.category_id) issues.push("category");
      return {
        id: String(row.public_id),
        name: String(row.name || ""),
        status: String(row.status || ""),
        issues,
      };
    })
    .filter((r) => r.issues.length > 0)
    .slice(0, 30);

  // Sample duplicate candidates from pending discovery barcodes
  const duplicates: QualityCentrePayload["duplicates"] = [];
  for (const item of discovery.items.slice(0, 12)) {
    if (!item.barcode && !item.name) continue;
    const matches = await findDuplicateProducts({
      barcode: item.barcode,
      name: item.name || undefined,
      brandName: item.brand,
    });
    for (const m of matches.slice(0, 2)) {
      duplicates.push({
        publicId: m.publicId,
        name: m.name,
        barcode: m.barcode ?? null,
        reason: m.reason,
      });
    }
  }

  const lowConfidenceDiscovery = discovery.items
    .filter((i) => (i.preview?.completeness ?? 100) < 55)
    .slice(0, 25)
    .map((i) => ({
      publicId: i.publicId,
      name: i.name,
      barcode: i.barcode,
      provider: i.provider,
      completeness: i.preview?.completeness ?? null,
    }));

  // Analytics aggregates
  const statusCounts = new Map<string, number>();
  const barcodeCounts = new Map<string, number>();
  const providerStats = new Map<string, { hits: number; misses: number }>();
  const dayCounts = new Map<string, number>();

  for (const row of weekScans.data || []) {
    const st = String(row.resolution_status || "unknown");
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
    const b = String(row.barcode || "");
    if (b) barcodeCounts.set(b, (barcodeCounts.get(b) || 0) + 1);
    const day = String(row.created_at || "").slice(0, 10);
    if (day) dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    const pr = Array.isArray(row.provider_results) ? row.provider_results : [];
    for (const p of pr as Array<{ provider?: string; status?: string }>) {
      const id = String(p.provider || "unknown");
      const cur = providerStats.get(id) || { hits: 0, misses: 0 };
      if (p.status === "hit") cur.hits += 1;
      else cur.misses += 1;
      providerStats.set(id, cur);
    }
  }

  return {
    kpis: {
      products: productsCount.count || 0,
      missingBarcode: missingBarcode.count || 0,
      missingImage: missingImage.count || 0,
      failedLookups24h: failed24.count || 0,
      scansToday: scansToday.count || scanRows.length,
      successfulMatchesToday,
      pendingDiscovery: discovery.counts.pending,
    },
    failedLookups: [...failedMap.values()].slice(0, 25),
    missingBarcodes: (missingBarcodeRows.data || []).map((r) => ({
      id: String(r.public_id),
      name: String(r.name || ""),
      status: String(r.status || ""),
      updatedAt: String(r.updated_at || ""),
    })),
    incomplete,
    duplicates: duplicates.slice(0, 20),
    lowConfidenceDiscovery,
    analytics: {
      scansByStatus: [...statusCounts.entries()].map(([key, value]) => ({
        key,
        label: key.replace(/_/g, " "),
        value,
      })),
      topBarcodes: [...barcodeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([barcode, count]) => ({ barcode, count })),
      providerHits: [...providerStats.entries()].map(([provider, s]) => ({
        provider,
        hits: s.hits,
        misses: s.misses,
      })),
      scansSeries: [...dayCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, value]) => ({ day: day.slice(5), value })),
    },
  };
}
