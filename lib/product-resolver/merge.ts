import type { BarcodeFormat } from "@/lib/catalogue/barcode-normalize";
import { emptyField } from "@/lib/product-resolver/field";
import type {
  CandidateField,
  CandidateImage,
  CandidateProduct,
  ProviderId,
  ProviderLookupResult,
} from "@/lib/product-resolver/types";

/** Higher = preferred when merging conflicting provider values. */
const PROVIDER_RANK: Record<ProviderId | "manual", number> = {
  klikcollect: 100,
  open_food_facts: 40,
  open_products_facts: 30,
  manual: 10,
};

function pickField<T>(
  fields: Array<CandidateField<T> | undefined | null>,
): CandidateField<T> {
  let best: CandidateField<T> | null = null;
  let bestRank = -1;
  for (const f of fields) {
    if (!f || f.value === null || f.value === undefined || f.value === "") continue;
    const rank = f.provider ? PROVIDER_RANK[f.provider] ?? 0 : 0;
    if (rank > bestRank) {
      best = f;
      bestRank = rank;
    }
  }
  return best || emptyField<T>();
}

function mergeImages(results: ProviderLookupResult[]): CandidateImage[] {
  const seen = new Set<string>();
  const out: CandidateImage[] = [];
  const ordered = [...results].sort(
    (a, b) =>
      (PROVIDER_RANK[b.provider] ?? 0) - (PROVIDER_RANK[a.provider] ?? 0),
  );
  for (const r of ordered) {
    for (const img of r.candidate?.images || []) {
      if (!img.url || seen.has(img.url)) continue;
      seen.add(img.url);
      out.push(img);
    }
  }
  return out;
}

export function mergeProviderResults(
  barcode: string,
  format: BarcodeFormat,
  results: ProviderLookupResult[],
): CandidateProduct | null {
  const hits = results.filter((r) => r.status === "hit" && r.candidate);
  if (!hits.length) return null;

  const sources = hits.flatMap((h) => h.candidate?.sources || []);

  return {
    barcode,
    format,
    name: pickField(hits.map((h) => h.candidate?.name)),
    brand: pickField(hits.map((h) => h.candidate?.brand)),
    genericName: pickField(hits.map((h) => h.candidate?.genericName)),
    quantity: pickField(hits.map((h) => h.candidate?.quantity)),
    unit: pickField(hits.map((h) => h.candidate?.unit)),
    description: pickField(hits.map((h) => h.candidate?.description)),
    ingredients: pickField(hits.map((h) => h.candidate?.ingredients)),
    allergens: pickField(hits.map((h) => h.candidate?.allergens)),
    additives: pickField(hits.map((h) => h.candidate?.additives)),
    traces: pickField(hits.map((h) => h.candidate?.traces)),
    nutrition: pickField(hits.map((h) => h.candidate?.nutrition)),
    nutriscore: pickField(hits.map((h) => h.candidate?.nutriscore)),
    labels: pickField(hits.map((h) => h.candidate?.labels)),
    externalCategories: pickField(
      hits.map((h) => h.candidate?.externalCategories),
    ),
    countries: pickField(hits.map((h) => h.candidate?.countries)),
    packaging: pickField(hits.map((h) => h.candidate?.packaging)),
    manufacturer: pickField(hits.map((h) => h.candidate?.manufacturer)),
    servingSize: pickField(hits.map((h) => h.candidate?.servingSize)),
    images: mergeImages(hits),
    sources,
  };
}

export function candidateCompleteness(c: CandidateProduct | null): {
  filled: number;
  total: number;
  needsCategory: boolean;
} {
  if (!c) return { filled: 0, total: 8, needsCategory: true };
  const keys: Array<keyof CandidateProduct> = [
    "name",
    "brand",
    "quantity",
    "ingredients",
    "allergens",
    "nutrition",
    "images",
  ];
  let filled = 0;
  for (const k of keys) {
    if (k === "images") {
      if (c.images.length) filled++;
      continue;
    }
    const f = c[k] as CandidateField;
    if (f?.value) filled++;
  }
  return {
    filled,
    total: keys.length,
    needsCategory: true,
  };
}
