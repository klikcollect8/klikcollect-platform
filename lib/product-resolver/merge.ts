import type { BarcodeFormat } from "@/lib/catalogue/barcode-normalize";
import { emptyField } from "@/lib/product-resolver/field";
import type {
  CandidateField,
  CandidateImage,
  CandidateProduct,
  CandidateSpec,
  ProviderId,
  ProviderLookupResult,
  SimilarQueryHints,
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

function mergeExtraAttributes(
  results: ProviderLookupResult[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const ordered = [...results].sort(
    (a, b) =>
      (PROVIDER_RANK[a.provider] ?? 0) - (PROVIDER_RANK[b.provider] ?? 0),
  );
  for (const r of ordered) {
    Object.assign(out, r.candidate?.extraAttributes || {});
  }
  return out;
}

function mergeSpecs(results: ProviderLookupResult[]): CandidateSpec[] {
  const seen = new Set<string>();
  const out: CandidateSpec[] = [];
  const ordered = [...results].sort(
    (a, b) =>
      (PROVIDER_RANK[b.provider] ?? 0) - (PROVIDER_RANK[a.provider] ?? 0),
  );
  for (const r of ordered) {
    for (const s of r.candidate?.specs || []) {
      if (!s.key || seen.has(s.key)) continue;
      seen.add(s.key);
      out.push(s);
    }
  }
  return out;
}

function mergeSimilarQuery(results: ProviderLookupResult[]): SimilarQueryHints {
  for (const r of results) {
    const q = r.candidate?.similarQuery;
    if (q && (q.brand || q.searchTerms || q.categoryTags?.length)) return q;
  }
  return {};
}

export function mergeProviderResults(
  barcode: string,
  format: BarcodeFormat,
  results: ProviderLookupResult[],
): CandidateProduct | null {
  const hits = results.filter((r) => r.status === "hit" && r.candidate);
  if (!hits.length) return null;

  const sources = hits.flatMap((h) => h.candidate?.sources || []);
  const rawSnapshot =
    hits.find((h) => h.candidate?.rawSnapshot)?.candidate?.rawSnapshot || null;

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
    novaGroup: pickField(hits.map((h) => h.candidate?.novaGroup)),
    ecoscore: pickField(hits.map((h) => h.candidate?.ecoscore)),
    labels: pickField(hits.map((h) => h.candidate?.labels)),
    externalCategories: pickField(
      hits.map((h) => h.candidate?.externalCategories),
    ),
    countries: pickField(hits.map((h) => h.candidate?.countries)),
    stores: pickField(hits.map((h) => h.candidate?.stores)),
    origins: pickField(hits.map((h) => h.candidate?.origins)),
    packaging: pickField(hits.map((h) => h.candidate?.packaging)),
    manufacturer: pickField(hits.map((h) => h.candidate?.manufacturer)),
    servingSize: pickField(hits.map((h) => h.candidate?.servingSize)),
    storage: pickField(hits.map((h) => h.candidate?.storage)),
    vegan: pickField(hits.map((h) => h.candidate?.vegan)),
    vegetarian: pickField(hits.map((h) => h.candidate?.vegetarian)),
    palmOil: pickField(hits.map((h) => h.candidate?.palmOil)),
    pnnsGroup: pickField(hits.map((h) => h.candidate?.pnnsGroup)),
    foodGroup: pickField(hits.map((h) => h.candidate?.foodGroup)),
    nutrientLevels: pickField(hits.map((h) => h.candidate?.nutrientLevels)),
    embCodes: pickField(hits.map((h) => h.candidate?.embCodes)),
    producerLink: pickField(hits.map((h) => h.candidate?.producerLink)),
    brandsAll: pickField(hits.map((h) => h.candidate?.brandsAll)),
    completeness: pickField(hits.map((h) => h.candidate?.completeness)),
    images: mergeImages(hits),
    extraAttributes: mergeExtraAttributes(hits),
    specs: mergeSpecs(hits),
    similarQuery: mergeSimilarQuery(hits),
    rawSnapshot,
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

/** Flatten candidate into string attributes for commit defaults. */
export function candidateToAttributes(
  c: CandidateProduct,
): Record<string, string> {
  const attrs: Record<string, string> = { ...(c.extraAttributes || {}) };
  if (c.ingredients.value) attrs.ingredients = String(c.ingredients.value);
  if (c.allergens.value) attrs.allergens = String(c.allergens.value);
  if (c.quantity.value) {
    attrs.quantity = String(c.quantity.value);
    attrs.pack_size = String(c.quantity.value);
  }
  if (c.unit.value) attrs.unit = String(c.unit.value);
  if (c.genericName.value) attrs.generic_name = String(c.genericName.value);
  if (c.nutriscore.value) attrs.nutriscore = String(c.nutriscore.value);
  if (c.novaGroup.value) attrs.nova_group = String(c.novaGroup.value);
  if (c.ecoscore.value) attrs.ecoscore = String(c.ecoscore.value);
  if (c.packaging.value) attrs.packaging = String(c.packaging.value);
  if (c.servingSize.value) attrs.serving_size = String(c.servingSize.value);
  if (c.additives.value) attrs.additives = String(c.additives.value);
  if (c.traces.value) attrs.traces = String(c.traces.value);
  if (c.origins.value) {
    attrs.origins = String(c.origins.value);
    attrs.country_of_origin = String(c.origins.value);
  }
  if (c.storage.value) attrs.storage = String(c.storage.value);
  if (c.vegan.value) attrs.vegan = String(c.vegan.value);
  if (c.vegetarian.value) attrs.vegetarian = String(c.vegetarian.value);
  if (c.palmOil.value) attrs.palm_oil = String(c.palmOil.value);
  if (c.pnnsGroup.value) attrs.pnns_group = String(c.pnnsGroup.value);
  if (c.foodGroup.value) attrs.food_group = String(c.foodGroup.value);
  if (c.embCodes.value) attrs.emb_codes = String(c.embCodes.value);
  if (c.producerLink.value) attrs.producer_link = String(c.producerLink.value);
  if (c.brandsAll.value) attrs.brands_all = String(c.brandsAll.value);
  if (c.completeness.value != null)
    attrs.off_completeness = String(c.completeness.value);
  if (c.nutrientLevels.value) {
    try {
      attrs.nutrient_levels = JSON.stringify(c.nutrientLevels.value);
    } catch {
      /* ignore */
    }
  }
  if (c.labels.value?.length) attrs.labels = c.labels.value.join(" | ");
  if (c.countries.value?.length)
    attrs.countries = c.countries.value.join(" | ");
  if (c.stores.value?.length) attrs.stores = c.stores.value.join(" | ");
  if (c.externalCategories.value?.length) {
    attrs.external_categories = c.externalCategories.value.join(" | ");
  }
  const dietary: string[] = [];
  if (c.vegan.value === "yes") dietary.push("Vegan");
  if (c.vegetarian.value === "yes") dietary.push("Vegetarian");
  if (c.palmOil.value === "no") dietary.push("Palm-oil free");
  if (dietary.length) attrs.dietary = dietary.join(", ");
  if (c.nutrition.value) {
    try {
      attrs.nutrition_json = JSON.stringify(c.nutrition.value);
    } catch {
      /* ignore */
    }
  }
  return attrs;
}

/** Map UI / legacy perishability labels to DB CHECK values. */
export function mapPerishabilityToDb(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const map: Record<string, string> = {
    ambient: "non_perishable",
    chilled: "refrigerated",
    fresh: "perishable",
    frozen: "frozen",
    non_perishable: "non_perishable",
    refrigerated: "refrigerated",
    perishable: "perishable",
  };
  return map[value] || null;
}
