import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  mergeProviderResults,
  candidateCompleteness,
} from "@/lib/product-resolver/merge";
import {
  findLocalProductByBarcode,
  klikCollectProvider,
} from "@/lib/product-resolver/providers/klikcollect";
import { openFoodFactsProvider } from "@/lib/product-resolver/providers/open-food-facts";
import { openProductsFactsProvider } from "@/lib/product-resolver/providers/open-products-facts";
import { upsertDiscoveryCandidate } from "@/lib/product-resolver/discovery";
import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import type {
  LocalProductHit,
  ProviderId,
  ProviderLookupResult,
  ResolveResult,
  ResolutionStatus,
  SimilarProductHit,
} from "@/lib/product-resolver/types";

function providerOrder(): ProductDataProvider[] {
  const raw = process.env.PRODUCT_RESOLVER_PROVIDER_ORDER || "";
  const map: Record<string, ProductDataProvider> = {
    klikcollect: klikCollectProvider,
    open_food_facts: openFoodFactsProvider,
    open_products_facts: openProductsFactsProvider,
  };
  if (!raw.trim()) {
    return [
      klikCollectProvider,
      openFoodFactsProvider,
      openProductsFactsProvider,
    ];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => map[id])
    .filter(Boolean);
}

async function writeScanEvent(input: {
  actorClerkUserId?: string | null;
  actorEmail?: string | null;
  barcode: string;
  format: string;
  resolutionStatus: ResolutionStatus;
  resolvedProductPublicId?: string | null;
  providerResults: ProviderLookupResult[];
}): Promise<string | null> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("barcode_scan_events")
      .insert({
        actor_clerk_user_id: input.actorClerkUserId || null,
        actor_email: input.actorEmail || null,
        barcode: input.barcode,
        format: input.format,
        resolution_status: input.resolutionStatus,
        resolved_product_public_id: input.resolvedProductPublicId || null,
        provider_results: input.providerResults.map((r) => ({
          provider: r.provider,
          status: r.status,
          message: r.message,
          fromCache: r.fromCache,
          externalProductId: r.externalProductId,
        })),
      })
      .select("id")
      .single();
    return data?.id || null;
  } catch (err) {
    console.error("[barcode_scan_events]", err);
    return null;
  }
}

async function catalogueBarcodesExist(
  barcodes: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!barcodes.length) return map;
  const sb = getServiceSupabase();
  const unique = [...new Set(barcodes.filter(Boolean))].slice(0, 40);
  const { data } = await sb
    .from("products")
    .select("public_id, barcode, gtin")
    .or(
      unique
        .flatMap((b) => [`barcode.eq.${b}`, `gtin.eq.${b}`])
        .join(","),
    )
    .is("deleted_at", null)
    .limit(80);
  for (const row of data || []) {
    if (row.barcode) map.set(String(row.barcode), String(row.public_id));
    if (row.gtin) map.set(String(row.gtin), String(row.public_id));
  }
  return map;
}

export async function findSimilarProducts(input: {
  seedBarcode: string;
  brand?: string | null;
  categoryTags?: string[];
  searchTerms?: string | null;
  limit?: number;
}): Promise<SimilarProductHit[]> {
  const limit = input.limit || 12;
  const terms =
    input.searchTerms?.trim() ||
    [input.brand, ...(input.categoryTags || []).slice(0, 1).map((t) =>
      t.replace(/^[a-z]{2}:/, "").replace(/-/g, " "),
    )]
      .filter(Boolean)
      .join(" ");

  if (!terms || terms.length < 2) return [];

  const results = await openFoodFactsProvider.searchProduct?.(terms);
  if (!results?.length) return [];

  const hits: SimilarProductHit[] = [];
  const barcodes: string[] = [];
  for (const r of results) {
    const code = r.candidate?.barcode || r.externalProductId || "";
    if (!code || code === input.seedBarcode) continue;
    barcodes.push(code);
    hits.push({
      barcode: code,
      name: r.candidate?.name?.value || null,
      brand: r.candidate?.brand?.value || null,
      image: r.candidate?.images?.[0]?.url || null,
      provider: r.provider,
      inCatalogue: false,
    });
    if (hits.length >= limit) break;
  }

  const existing = await catalogueBarcodesExist(barcodes);
  for (const h of hits) {
    const id = existing.get(h.barcode);
    if (id) {
      h.inCatalogue = true;
      h.localProductId = id;
    } else if (rCandidateWorthDiscovery(h)) {
      await upsertDiscoveryCandidate({
        barcode: h.barcode,
        name: h.name,
        brand: h.brand,
        provider: h.provider,
        externalProductId: h.barcode,
        source: "similar",
        payload: {
          barcode: h.barcode,
          name: h.name,
          brand: h.brand,
          image: h.image,
        },
        similaritySeedBarcode: input.seedBarcode,
      });
    }
  }
  return hits;
}

function rCandidateWorthDiscovery(h: SimilarProductHit): boolean {
  return Boolean(h.barcode && h.name);
}

export async function resolveBarcode(input: {
  barcode: string;
  formatHint?: string | null;
  actorClerkUserId?: string | null;
  actorEmail?: string | null;
  skipExternal?: boolean;
  includeSimilar?: boolean;
}): Promise<ResolveResult> {
  const normalised = normaliseBarcode(input.barcode, {
    formatHint: input.formatHint,
    requireGtin: true,
  });

  if (!normalised.valid) {
    const result: ResolveResult = {
      barcode: normalised.value || input.barcode,
      format: normalised.format,
      valid: false,
      resolutionStatus: "invalid",
      localProduct: null,
      candidate: null,
      providerResults: [],
      message: normalised.error || "Invalid barcode.",
    };
    result.scanEventId = await writeScanEvent({
      ...input,
      barcode: result.barcode,
      format: result.format,
      resolutionStatus: "invalid",
      providerResults: [],
    });
    return result;
  }

  const barcode = normalised.value;
  const localProduct = await findLocalProductByBarcode(barcode);

  if (localProduct) {
    const kc = await klikCollectProvider.getProductByBarcode(barcode);
    const result: ResolveResult = {
      barcode,
      format: normalised.format,
      valid: true,
      resolutionStatus: "local_found",
      localProduct,
      candidate: (kc.candidate as ResolveResult["candidate"]) || null,
      providerResults: [kc],
      message: "Product already exists in KlikCollect.",
      similarProducts: [],
    };
    result.scanEventId = await writeScanEvent({
      actorClerkUserId: input.actorClerkUserId,
      actorEmail: input.actorEmail,
      barcode,
      format: normalised.format,
      resolutionStatus: "local_found",
      resolvedProductPublicId: localProduct.id,
      providerResults: [kc],
    });
    return result;
  }

  if (input.skipExternal) {
    return {
      barcode,
      format: normalised.format,
      valid: true,
      resolutionStatus: "not_found",
      localProduct: null,
      candidate: null,
      providerResults: [],
      message: "Barcode found, product information unavailable.",
    };
  }

  const providers = providerOrder().filter(
    (p) => p.getProviderName() !== "klikcollect",
  );
  const settled = await Promise.all(
    providers.map((p) => p.getProductByBarcode(barcode)),
  );
  const providerResults: ProviderLookupResult[] = [...settled];

  const candidate = mergeProviderResults(
    barcode,
    normalised.format,
    providerResults,
  );
  const completeness = candidateCompleteness(candidate);
  let resolutionStatus: ResolutionStatus = "not_found";
  let message = "Barcode found, product information unavailable.";

  if (candidate && completeness.filled >= 3) {
    resolutionStatus = "external_found";
    message = "Product found in product databases.";
  } else if (candidate && completeness.filled > 0) {
    resolutionStatus = "partial";
    message = "Partial product information found. Review carefully.";
  }

  let discoveryId: string | null = null;
  if (candidate) {
    discoveryId = await upsertDiscoveryCandidate({
      barcode,
      name: candidate.name.value,
      brand: candidate.brand.value,
      provider: candidate.sources[0]?.provider || "open_food_facts",
      externalProductId: candidate.sources[0]?.externalProductId || barcode,
      source: "scan",
      payload: candidate,
    });
  }

  let similarProducts: SimilarProductHit[] = [];
  if (candidate && input.includeSimilar !== false) {
    try {
      similarProducts = await findSimilarProducts({
        seedBarcode: barcode,
        brand: candidate.similarQuery.brand || candidate.brand.value,
        categoryTags: candidate.similarQuery.categoryTags,
        searchTerms: candidate.similarQuery.searchTerms,
      });
    } catch (err) {
      console.error("[findSimilarProducts]", err);
    }
  }

  const result: ResolveResult = {
    barcode,
    format: normalised.format,
    valid: true,
    resolutionStatus,
    localProduct: null,
    candidate,
    providerResults,
    message,
    discoveryId,
    similarProducts,
  };
  result.scanEventId = await writeScanEvent({
    actorClerkUserId: input.actorClerkUserId,
    actorEmail: input.actorEmail,
    barcode,
    format: normalised.format,
    resolutionStatus,
    providerResults,
  });
  return result;
}

export type SearchResolveResult = {
  query: string;
  local: LocalProductHit[];
  external: Array<{
    barcode: string;
    name: string | null;
    brand: string | null;
    image: string | null;
    provider: ProviderId;
    inCatalogue: boolean;
    localProductId?: string | null;
    discoveryId?: string | null;
    quantity?: string | null;
    nutriscore?: string | null;
    categoryHint?: string | null;
  }>;
};

export async function searchProducts(input: {
  q: string;
  /** Persist external hits into discovery queue (default true for scanner). */
  persist?: boolean;
  pageSize?: number;
}): Promise<SearchResolveResult> {
  const q = input.q.trim();
  const local: LocalProductHit[] = [];
  const external: SearchResolveResult["external"] = [];
  const persist = input.persist !== false;

  if (q.length < 2) return { query: q, local, external };

  // Digit-heavy → try barcode resolve path first
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 14) {
    const byCode = await findLocalProductByBarcode(digits);
    if (byCode) local.push(byCode);
  }

  const sb = getServiceSupabase();
  // Escape PostgREST filter special chars in ilike patterns
  const qSafe = q.replace(/[%_,.\\]/g, "\\$&");
  const { data: rows } = await sb
    .from("products")
    .select(
      "public_id, name, sku, barcode, gtin, status, image_url, brand_id, category_id, updated_at",
    )
    .or(
      `name.ilike.%${qSafe}%,sku.ilike.%${qSafe}%,barcode.ilike.%${qSafe}%,gtin.ilike.%${qSafe}%`,
    )
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(20);

  for (const row of rows || []) {
    if (local.some((l) => l.id === row.public_id)) continue;
    local.push({
      id: row.public_id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      gtin: row.gtin,
      status: row.status,
      image: row.image_url,
      brand: null,
      categoryId: row.category_id,
      categoryName: null,
      updatedAt: row.updated_at,
    });
  }

  // Always search external databases for related products (name / category / brand)
  const off = await openFoodFactsProvider.searchProduct?.(q, {
    pageSize: input.pageSize || 28,
  });
  const barcodes = (off || [])
    .map((r) => r.candidate?.barcode || r.externalProductId || "")
    .filter(Boolean);
  const existing = await catalogueBarcodesExist(barcodes);

  for (const r of off || []) {
    const code = r.candidate?.barcode || r.externalProductId || "";
    if (!code) continue;
    const inCat = existing.has(code);
    let discoveryId: string | null = null;
    if (persist && !inCat && r.candidate) {
      discoveryId = await upsertDiscoveryCandidate({
        barcode: code,
        name: r.candidate.name?.value || null,
        brand: r.candidate.brand?.value || null,
        provider: r.provider,
        externalProductId: r.externalProductId || code,
        source: "search",
        payload: r.candidate,
      });
    }
    const cats = r.candidate?.externalCategories?.value;
    external.push({
      barcode: code,
      name: r.candidate?.name?.value || null,
      brand: r.candidate?.brand?.value || null,
      image: r.candidate?.images?.[0]?.url || null,
      provider: r.provider,
      inCatalogue: inCat,
      localProductId: existing.get(code) || null,
      discoveryId,
      quantity: r.candidate?.quantity?.value || null,
      nutriscore: r.candidate?.nutriscore?.value || null,
      categoryHint: Array.isArray(cats) && cats.length ? cats[0] : null,
    });
  }

  return { query: q, local, external };
}

export function listConfiguredProviders(): ProviderId[] {
  return providerOrder().map((p) => p.getProviderName());
}
