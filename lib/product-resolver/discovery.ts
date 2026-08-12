import { getServiceSupabase } from "@/lib/supabase/admin";
import type {
  CandidateProduct,
  DiscoveryCandidateRow,
  DiscoveryStatusCounts,
  ProviderId,
} from "@/lib/product-resolver/types";

function fieldVal(payload: Record<string, unknown>, key: string): string | null {
  const f = payload[key];
  if (f && typeof f === "object" && "value" in f) {
    const v = (f as { value?: unknown }).value;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  if (typeof f === "string" && f.trim()) return f.trim();
  return null;
}

function derivePreview(
  payload: Partial<CandidateProduct> | Record<string, unknown>,
): DiscoveryCandidateRow["preview"] {
  const p = payload as Record<string, unknown>;
  const images = Array.isArray(p.images) ? p.images : [];
  const firstImg =
    (images[0] &&
      typeof images[0] === "object" &&
      (images[0] as { url?: string }).url) ||
    (typeof p.image === "string" ? p.image : null);

  const cats = p.externalCategories as
    | { value?: string[] }
    | string[]
    | undefined;
  let categoryHint: string | null = null;
  if (Array.isArray(cats)) categoryHint = cats[0] || null;
  else if (cats?.value?.length) categoryHint = cats.value[0] || null;

  const ingredients = fieldVal(p, "ingredients");
  let filled = 0;
  const checks = [
    fieldVal(p, "name"),
    fieldVal(p, "brand"),
    fieldVal(p, "quantity"),
    ingredients,
    fieldVal(p, "allergens"),
    fieldVal(p, "nutriscore"),
    firstImg,
  ];
  for (const c of checks) if (c) filled++;

  return {
    image: firstImg || null,
    quantity: fieldVal(p, "quantity"),
    nutriscore: fieldVal(p, "nutriscore"),
    ingredientsPreview: ingredients
      ? ingredients.length > 120
        ? `${ingredients.slice(0, 120)}…`
        : ingredients
      : null,
    categoryHint,
    completeness: Math.round((filled / checks.length) * 100),
  };
}

/** PostgREST rejects non-UUID values in `id.eq.` (uuid column). */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function discoveryIdFilter(idOrPublicId: string): string {
  return isUuid(idOrPublicId)
    ? `public_id.eq.${idOrPublicId},id.eq.${idOrPublicId}`
    : `public_id.eq.${idOrPublicId}`;
}

function mapRow(row: Record<string, unknown>): DiscoveryCandidateRow {
  const payload =
    (row.payload as DiscoveryCandidateRow["payload"]) || {};
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    barcode: (row.barcode as string) || null,
    name: (row.name as string) || null,
    brand: (row.brand as string) || null,
    provider: String(row.provider),
    externalProductId: (row.external_product_id as string) || null,
    source: row.source as DiscoveryCandidateRow["source"],
    payload,
    status: row.status as DiscoveryCandidateRow["status"],
    resolvedProductPublicId:
      (row.resolved_product_public_id as string) || null,
    similaritySeedBarcode: (row.similarity_seed_barcode as string) || null,
    lastSeenAt: String(row.last_seen_at),
    createdAt: String(row.created_at),
    confidenceBand: (row.confidence_band as DiscoveryCandidateRow["confidenceBand"]) || null,
    confidenceScore:
      row.confidence_score != null ? Number(row.confidence_score) : null,
    preview: derivePreview(payload),
  };
}

export async function upsertDiscoveryCandidate(input: {
  barcode?: string | null;
  name?: string | null;
  brand?: string | null;
  provider: ProviderId | string;
  externalProductId?: string | null;
  source: "scan" | "similar" | "search";
  payload: Partial<CandidateProduct> | Record<string, unknown>;
  similaritySeedBarcode?: string | null;
}): Promise<string | null> {
  const sb = getServiceSupabase();
  const now = new Date().toISOString();
  const barcode = input.barcode?.trim() || null;

  try {
    if (barcode) {
      const { data: existing } = await sb
        .from("product_discovery_candidates")
        .select("id, status, public_id")
        .eq("barcode", barcode)
        .maybeSingle();

      if (existing?.id) {
        if (existing.status === "imported") {
          return existing.public_id || existing.id;
        }
        await sb
          .from("product_discovery_candidates")
          .update({
            name: input.name || null,
            brand: input.brand || null,
            provider: input.provider,
            external_product_id: input.externalProductId || null,
            source: input.source,
            payload: input.payload || {},
            similarity_seed_barcode: input.similaritySeedBarcode || null,
            status:
              existing.status === "dismissed" ? "pending" : existing.status,
            last_seen_at: now,
            updated_at: now,
          })
          .eq("id", existing.id);
        return existing.public_id || existing.id;
      }
    }

    const { data, error } = await sb
      .from("product_discovery_candidates")
      .insert({
        barcode,
        name: input.name || null,
        brand: input.brand || null,
        provider: input.provider,
        external_product_id: input.externalProductId || null,
        source: input.source,
        payload: input.payload || {},
        status: "pending",
        similarity_seed_barcode: input.similaritySeedBarcode || null,
        last_seen_at: now,
        updated_at: now,
      })
      .select("public_id")
      .single();

    if (error) {
      console.error("[upsertDiscoveryCandidate]", error);
      return null;
    }
    return data?.public_id || null;
  } catch (err) {
    console.error("[upsertDiscoveryCandidate]", err);
    return null;
  }
}

export async function markDiscoveryImported(input: {
  barcode?: string | null;
  discoveryId?: string | null;
  productPublicId: string;
}): Promise<void> {
  const sb = getServiceSupabase();
  const now = new Date().toISOString();
  const patch = {
    status: "imported" as const,
    resolved_product_public_id: input.productPublicId,
    updated_at: now,
    last_seen_at: now,
  };
  try {
    if (input.discoveryId) {
      await sb
        .from("product_discovery_candidates")
        .update(patch)
        .or(discoveryIdFilter(input.discoveryId));
    }
    if (input.barcode) {
      await sb
        .from("product_discovery_candidates")
        .update(patch)
        .eq("barcode", input.barcode);
    }
  } catch (err) {
    console.error("[markDiscoveryImported]", err);
  }
}

export async function countDiscoveryByStatus(): Promise<DiscoveryStatusCounts> {
  const sb = getServiceSupabase();
  const counts: DiscoveryStatusCounts = {
    pending: 0,
    imported: 0,
    dismissed: 0,
  };
  try {
    for (const status of ["pending", "imported", "dismissed"] as const) {
      const { count } = await sb
        .from("product_discovery_candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count || 0;
    }
  } catch (err) {
    console.error("[countDiscoveryByStatus]", err);
  }
  return counts;
}

export async function listDiscoveryCandidates(input?: {
  status?: "pending" | "imported" | "dismissed";
  q?: string;
  source?: string;
  provider?: string;
  brand?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: DiscoveryCandidateRow[];
  total: number;
  counts: DiscoveryStatusCounts;
}> {
  const sb = getServiceSupabase();
  const status = input?.status || "pending";
  const limit = Math.min(input?.limit || 40, 100);
  const offset = input?.offset || 0;

  let query = sb
    .from("product_discovery_candidates")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input?.source) query = query.eq("source", input.source);
  if (input?.provider) query = query.eq("provider", input.provider);
  if (input?.brand?.trim()) {
    query = query.ilike("brand", `%${input.brand.trim()}%`);
  }
  if (input?.q?.trim()) {
    const q = input.q.trim();
    query = query.or(
      `name.ilike.%${q}%,barcode.ilike.%${q}%,brand.ilike.%${q}%`,
    );
  }

  const [{ data, count, error }, counts] = await Promise.all([
    query,
    countDiscoveryByStatus(),
  ]);

  if (error) {
    console.error("[listDiscoveryCandidates]", error);
    return { items: [], total: 0, counts };
  }
  return {
    items: (data || []).map((r) => mapRow(r as Record<string, unknown>)),
    total: count || 0,
    counts,
  };
}

export async function dismissDiscoveryCandidate(
  idOrPublicId: string,
): Promise<boolean> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("product_discovery_candidates")
    .update({
      status: "dismissed",
      updated_at: new Date().toISOString(),
    })
    .or(discoveryIdFilter(idOrPublicId))
    .select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

export async function restoreDiscoveryCandidate(
  idOrPublicId: string,
): Promise<boolean> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("product_discovery_candidates")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .or(discoveryIdFilter(idOrPublicId))
    .neq("status", "imported")
    .select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

export async function bulkUpdateDiscoveryStatus(input: {
  ids: string[];
  action: "dismiss" | "restore";
}): Promise<number> {
  const ids = [...new Set(input.ids.filter(Boolean))].slice(0, 50);
  if (!ids.length) return 0;
  let ok = 0;
  for (const id of ids) {
    const success =
      input.action === "dismiss"
        ? await dismissDiscoveryCandidate(id)
        : await restoreDiscoveryCandidate(id);
    if (success) ok++;
  }
  return ok;
}

export async function getDiscoveryCandidate(
  idOrPublicId: string,
): Promise<DiscoveryCandidateRow | null> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("product_discovery_candidates")
    .select("*")
    .or(discoveryIdFilter(idOrPublicId))
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Distinct brands in pending queue for filter chips. */
export async function listDiscoveryBrands(
  status: "pending" | "imported" | "dismissed" = "pending",
): Promise<string[]> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("product_discovery_candidates")
    .select("brand")
    .eq("status", status)
    .not("brand", "is", null)
    .order("brand")
    .limit(200);
  const set = new Set<string>();
  for (const row of data || []) {
    const b = String(row.brand || "").trim();
    if (b) set.add(b);
  }
  return [...set].slice(0, 40);
}
