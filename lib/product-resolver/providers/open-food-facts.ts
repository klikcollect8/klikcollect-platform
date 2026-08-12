import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import { fieldFromProvider } from "@/lib/product-resolver/field";
import {
  canCallProvider,
  fetchWithRetry,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/product-resolver/rate-limit";
import { getCachedLookup, setCachedLookup } from "@/lib/product-resolver/cache";
import type {
  CandidateImage,
  CandidateProduct,
  CandidateSpec,
  ProviderLookupResult,
} from "@/lib/product-resolver/types";

const PROVIDER = "open_food_facts" as const;
const BASE = "https://world.openfoodfacts.org";

function userAgent(): string {
  return (
    process.env.KLIKCOLLECT_PRODUCT_RESOLVER_USER_AGENT ||
    "KlikCollect/0.1.0 (https://klikcollect-platform.vercel.app; catalogue-resolver@klikcollect)"
  );
}

function pickLang(obj: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!obj) return null;
  const v =
    obj[`${key}_en`] ??
    obj[key] ??
    obj[`${key}_fr`] ??
    null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function cleanTag(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim();
}

function nutritionSpecs(nutrition: Record<string, unknown> | null): CandidateSpec[] {
  if (!nutrition) return [];
  const keys: Array<[string, string]> = [
    ["energy-kcal_100g", "Energy (kcal/100g)"],
    ["energy_100g", "Energy (kJ/100g)"],
    ["fat_100g", "Fat (g/100g)"],
    ["saturated-fat_100g", "Saturated fat (g/100g)"],
    ["trans-fat_100g", "Trans fat (g/100g)"],
    ["cholesterol_100g", "Cholesterol (g/100g)"],
    ["carbohydrates_100g", "Carbohydrates (g/100g)"],
    ["sugars_100g", "Sugars (g/100g)"],
    ["fiber_100g", "Fibre (g/100g)"],
    ["proteins_100g", "Protein (g/100g)"],
    ["salt_100g", "Salt (g/100g)"],
    ["sodium_100g", "Sodium (g/100g)"],
    ["alcohol_100g", "Alcohol (%/100g)"],
    ["calcium_100g", "Calcium (g/100g)"],
    ["iron_100g", "Iron (g/100g)"],
    ["vitamin-a_100g", "Vitamin A (g/100g)"],
    ["vitamin_a_100g", "Vitamin A (g/100g)"],
    ["vitamin-c_100g", "Vitamin C (g/100g)"],
    ["vitamin_c_100g", "Vitamin C (g/100g)"],
    ["vitamin-d_100g", "Vitamin D (g/100g)"],
    ["vitamin_d_100g", "Vitamin D (g/100g)"],
    ["potassium_100g", "Potassium (g/100g)"],
  ];
  const out: CandidateSpec[] = [];
  const seen = new Set<string>();
  for (const [k, label] of keys) {
    const v = nutrition[k];
    if (v === null || v === undefined || v === "") continue;
    out.push({ key: label, value: String(v) });
    seen.add(k);
  }
  // Catch remaining *_100g numeric nutriments
  for (const [k, v] of Object.entries(nutrition)) {
    if (!k.endsWith("_100g") || seen.has(k)) continue;
    if (v === null || v === undefined || v === "" || typeof v === "object")
      continue;
    if (!/^[a-z0-9_-]+_100g$/i.test(k)) continue;
    const label = k
      .replace(/_100g$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({ key: `${label} (100g)`, value: String(v) });
    if (out.length >= 50) break;
  }
  return out;
}

function analysisFlag(
  tags: string[],
  yesTag: string,
  noTag: string,
): string | null {
  if (tags.some((t) => t.includes(yesTag))) return "yes";
  if (tags.some((t) => t.includes(noTag))) return "no";
  return null;
}

function slimSnapshot(product: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "code",
    "product_name",
    "generic_name",
    "brands",
    "quantity",
    "serving_size",
    "packaging",
    "manufacturing_places",
    "ingredients_text",
    "allergens",
    "traces",
    "nutriscore_grade",
    "nova_group",
    "ecoscore_grade",
    "categories",
    "labels",
    "countries",
    "stores",
    "origins",
    "conservation_conditions",
    "ingredients_analysis_tags",
    "pnns_groups_1",
    "pnns_groups_2",
    "food_groups",
    "nutrient_levels",
    "emb_codes",
    "link",
    "product_quantity",
    "product_quantity_unit",
    "completeness",
    "image_front_url",
    "image_url",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (product[k] !== undefined) out[k] = product[k];
  }
  if (product.nutriments && typeof product.nutriments === "object") {
    out.nutriments = product.nutriments;
  }
  return out;
}

export function createOpenFoodFactsProvider(
  opts?: { host?: string; providerId?: "open_food_facts" | "open_products_facts" },
): ProductDataProvider {
  const host = (opts?.host || BASE).replace(/\/$/, "");
  const providerId = opts?.providerId || PROVIDER;

  const normaliseResponse = (
    raw: unknown,
    barcode: string,
  ): Partial<CandidateProduct> | null => {
    if (!raw || typeof raw !== "object") return null;
    const body = raw as Record<string, unknown>;
    const product = (body.product || body) as Record<string, unknown> | undefined;
    if (!product || typeof product !== "object") return null;

    const status = body.status ?? product.status;
    const resultObj =
      body.result && typeof body.result === "object"
        ? (body.result as Record<string, unknown>)
        : null;
    if (
      status === 0 ||
      status === "failure" ||
      resultObj?.status === "failure"
    ) {
      return null;
    }

    const extId =
      String(product.code || product._id || product.id || barcode || "").trim() ||
      barcode;
    const name =
      pickLang(product, "product_name") ||
      pickLang(product, "generic_name") ||
      null;
    if (!name && !extId) return null;

    const brandsRaw =
      typeof product.brands === "string" ? product.brands : null;
    const brand =
      brandsRaw?.split(",")[0]?.trim() ||
      asStringArray(product.brands_tags).map(cleanTag)[0] ||
      null;
    const brandsAll =
      brandsRaw ||
      asStringArray(product.brands_tags).map(cleanTag).join(", ") ||
      null;
    const genericName = pickLang(product, "generic_name");
    const quantity =
      typeof product.quantity === "string"
        ? product.quantity
        : product.product_quantity != null
          ? `${product.product_quantity}${
              typeof product.product_quantity_unit === "string"
                ? ` ${product.product_quantity_unit}`
                : ""
            }`.trim()
          : null;
    const unit =
      typeof product.product_quantity_unit === "string"
        ? product.product_quantity_unit
        : quantity?.match(/\b(g|kg|ml|l|cl|oz|lb)\b/i)?.[1]?.toLowerCase() ||
          null;
    const ingredients =
      pickLang(product, "ingredients_text") ||
      (typeof product.ingredients_text === "string"
        ? product.ingredients_text
        : null);
    const allergens =
      typeof product.allergens_tags === "object"
        ? asStringArray(product.allergens_tags).map(cleanTag).join(", ")
        : typeof product.allergens === "string"
          ? product.allergens
          : null;
    const additives =
      asStringArray(product.additives_tags).map(cleanTag).join(", ") || null;
    const traces =
      typeof product.traces === "string"
        ? product.traces
        : asStringArray(product.traces_tags).map(cleanTag).join(", ") || null;
    const nutriscore =
      typeof product.nutriscore_grade === "string"
        ? product.nutriscore_grade.toUpperCase()
        : typeof product.nutrition_grades === "string"
          ? product.nutrition_grades.toUpperCase()
          : null;
    const novaGroup =
      product.nova_group != null ? String(product.nova_group) : null;
    const ecoscore =
      typeof product.ecoscore_grade === "string"
        ? product.ecoscore_grade.toUpperCase()
        : null;
    const labels = asStringArray(product.labels_tags || product.labels).map(
      cleanTag,
    );
    const categories = asStringArray(
      product.categories_tags || product.categories,
    ).map(cleanTag);
    const categoryTags = asStringArray(product.categories_tags);
    const countries = asStringArray(
      product.countries_tags || product.countries,
    ).map(cleanTag);
    const stores = asStringArray(product.stores_tags || product.stores).map(
      cleanTag,
    );
    const origins =
      typeof product.origins === "string"
        ? product.origins
        : asStringArray(product.origins_tags).map(cleanTag).join(", ") || null;
    const packaging =
      typeof product.packaging === "string"
        ? product.packaging
        : asStringArray(product.packaging_tags).map(cleanTag).join(", ") ||
          null;
    const manufacturer =
      typeof product.manufacturing_places === "string"
        ? product.manufacturing_places
        : typeof product.brand_owner === "string"
          ? product.brand_owner
          : null;
    const servingSize =
      typeof product.serving_size === "string" ? product.serving_size : null;
    const nutrition =
      product.nutriments && typeof product.nutriments === "object"
        ? (product.nutriments as Record<string, unknown>)
        : null;
    const analysisTags = asStringArray(product.ingredients_analysis_tags);
    const vegan = analysisFlag(analysisTags, "en:vegan", "en:non-vegan");
    const vegetarian = analysisFlag(
      analysisTags,
      "en:vegetarian",
      "en:non-vegetarian",
    );
    const palmOil = analysisFlag(
      analysisTags,
      "en:palm-oil",
      "en:palm-oil-free",
    );
    // OFF palm-oil-free means no palm oil → flip sense for palmOil field
    const palmOilNorm =
      analysisTags.some((t) => t.includes("palm-oil-free"))
        ? "no"
        : analysisTags.some((t) => t.includes("en:palm-oil") && !t.includes("free"))
          ? "yes"
          : palmOil;
    const pnnsGroup =
      (typeof product.pnns_groups_2 === "string" && product.pnns_groups_2) ||
      (typeof product.pnns_groups_1 === "string" && product.pnns_groups_1) ||
      null;
    const foodGroup =
      typeof product.food_groups === "string"
        ? cleanTag(product.food_groups)
        : asStringArray(product.food_groups_tags).map(cleanTag)[0] || null;
    const nutrientLevelsRaw =
      product.nutrient_levels && typeof product.nutrient_levels === "object"
        ? (product.nutrient_levels as Record<string, unknown>)
        : null;
    const nutrientLevels: Record<string, string> | null = nutrientLevelsRaw
      ? Object.fromEntries(
          Object.entries(nutrientLevelsRaw)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, String(v)]),
        )
      : null;
    const storage =
      typeof product.conservation_conditions === "string"
        ? product.conservation_conditions
        : pickLang(product, "conservation_conditions") || null;
    const embCodes =
      typeof product.emb_codes === "string"
        ? product.emb_codes
        : asStringArray(product.emb_codes_tags).map(cleanTag).join(", ") ||
          null;
    const producerLink =
      typeof product.link === "string" && product.link.startsWith("http")
        ? product.link
        : null;
    const completeness =
      typeof product.completeness === "number"
        ? Math.round(product.completeness * (product.completeness <= 1 ? 100 : 1))
        : typeof product.completeness === "string" &&
            !Number.isNaN(Number(product.completeness))
          ? Math.round(Number(product.completeness))
          : null;

    const images: CandidateImage[] = [];
    const pushImg = (url: unknown, role: CandidateImage["role"]) => {
      if (typeof url === "string" && url.startsWith("http")) {
        if (images.some((i) => i.url === url)) return;
        images.push({
          url,
          role,
          provider: providerId,
          sourceUrl: url,
        });
      }
    };
    pushImg(product.image_front_url || product.image_url, "front");
    pushImg(product.image_front_small_url, "gallery");
    pushImg(product.image_ingredients_url, "ingredients");
    pushImg(product.image_nutrition_url, "nutrition");
    pushImg(product.image_packaging_url, "packaging");
    // Selected images map (OFF)
    const selected = product.selected_images as
      | Record<string, Record<string, Record<string, string>>>
      | undefined;
    if (selected) {
      for (const role of ["front", "ingredients", "nutrition", "packaging"] as const) {
        const display = selected[role]?.display || selected[role]?.small;
        if (display) {
          pushImg(display.en || display.fr || Object.values(display)[0], role);
        }
      }
    }

    const specs = nutritionSpecs(nutrition);
    if (quantity) specs.unshift({ key: "Pack quantity", value: quantity, provider: providerId });
    if (servingSize)
      specs.push({ key: "Serving size", value: servingSize, provider: providerId });
    if (nutriscore)
      specs.push({ key: "Nutri-Score", value: nutriscore, provider: providerId });
    if (novaGroup)
      specs.push({ key: "NOVA group", value: novaGroup, provider: providerId });
    if (ecoscore)
      specs.push({ key: "Eco-Score", value: ecoscore, provider: providerId });

    if (pnnsGroup)
      specs.push({ key: "PNNS group", value: pnnsGroup, provider: providerId });
    if (foodGroup)
      specs.push({ key: "Food group", value: foodGroup, provider: providerId });
    if (unit) specs.push({ key: "Unit", value: unit, provider: providerId });
    if (storage)
      specs.push({ key: "Storage", value: storage, provider: providerId });
    if (nutrientLevels) {
      for (const [k, v] of Object.entries(nutrientLevels)) {
        specs.push({
          key: `Nutrient level: ${k}`,
          value: v,
          provider: providerId,
        });
      }
    }

    const extraAttributes: Record<string, string> = {};
    if (novaGroup) extraAttributes.nova_group = novaGroup;
    if (ecoscore) extraAttributes.ecoscore = ecoscore;
    if (origins) extraAttributes.origins = origins;
    if (stores.length) extraAttributes.stores = stores.join(" | ");
    if (labels.length) extraAttributes.labels = labels.join(" | ");
    if (countries.length) extraAttributes.countries = countries.join(" | ");
    if (packaging) extraAttributes.packaging = packaging;
    if (servingSize) extraAttributes.serving_size = servingSize;
    if (additives) extraAttributes.additives = additives;
    if (traces) extraAttributes.traces = traces;
    if (unit) extraAttributes.unit = unit;
    if (storage) extraAttributes.storage = storage;
    if (vegan) extraAttributes.vegan = vegan;
    if (vegetarian) extraAttributes.vegetarian = vegetarian;
    if (palmOilNorm) extraAttributes.palm_oil = palmOilNorm;
    if (pnnsGroup) extraAttributes.pnns_group = pnnsGroup;
    if (foodGroup) extraAttributes.food_group = foodGroup;
    if (embCodes) extraAttributes.emb_codes = embCodes;
    if (producerLink) extraAttributes.producer_link = producerLink;
    if (brandsAll) extraAttributes.brands_all = brandsAll;
    if (genericName) extraAttributes.generic_name = genericName;
    if (completeness != null)
      extraAttributes.off_completeness = String(completeness);
    if (nutrientLevels) {
      try {
        extraAttributes.nutrient_levels = JSON.stringify(nutrientLevels);
      } catch {
        /* ignore */
      }
    }
    if (nutrition) {
      try {
        extraAttributes.nutrition_json = JSON.stringify(nutrition);
      } catch {
        /* ignore */
      }
    }
    extraAttributes.data_source = providerId;

    const fetchedAt = new Date().toISOString();
    const sourceUrl = `${host}/product/${encodeURIComponent(extId)}`;

    return {
      barcode: barcode || extId,
      name: fieldFromProvider(name, providerId, {
        externalProductId: extId,
        confidence: name ? "high" : "unknown",
      }),
      brand: fieldFromProvider(brand, providerId, {
        externalProductId: extId,
        confidence: brand ? "high" : "unknown",
      }),
      genericName: fieldFromProvider(genericName, providerId, {
        externalProductId: extId,
      }),
      quantity: fieldFromProvider(quantity, providerId, {
        externalProductId: extId,
      }),
      unit: fieldFromProvider(unit, providerId, {
        externalProductId: extId,
      }),
      description: fieldFromProvider(genericName || name, providerId, {
        externalProductId: extId,
        confidence: "low",
      }),
      ingredients: fieldFromProvider(ingredients, providerId, {
        externalProductId: extId,
        confidence: ingredients ? "medium" : "unknown",
      }),
      allergens: fieldFromProvider(allergens, providerId, {
        externalProductId: extId,
      }),
      additives: fieldFromProvider(additives, providerId, {
        externalProductId: extId,
      }),
      traces: fieldFromProvider(traces, providerId, {
        externalProductId: extId,
      }),
      nutrition: fieldFromProvider(nutrition, providerId, {
        externalProductId: extId,
        confidence: nutrition ? "medium" : "unknown",
      }),
      nutriscore: fieldFromProvider(nutriscore, providerId, {
        externalProductId: extId,
      }),
      novaGroup: fieldFromProvider(novaGroup, providerId, {
        externalProductId: extId,
      }),
      ecoscore: fieldFromProvider(ecoscore, providerId, {
        externalProductId: extId,
      }),
      labels: fieldFromProvider(labels, providerId, {
        externalProductId: extId,
      }),
      externalCategories: fieldFromProvider(categories, providerId, {
        externalProductId: extId,
        confidence: "low",
      }),
      countries: fieldFromProvider(countries, providerId, {
        externalProductId: extId,
      }),
      stores: fieldFromProvider(stores, providerId, {
        externalProductId: extId,
      }),
      origins: fieldFromProvider(origins, providerId, {
        externalProductId: extId,
      }),
      packaging: fieldFromProvider(packaging, providerId, {
        externalProductId: extId,
      }),
      manufacturer: fieldFromProvider(manufacturer, providerId, {
        externalProductId: extId,
      }),
      servingSize: fieldFromProvider(servingSize, providerId, {
        externalProductId: extId,
      }),
      storage: fieldFromProvider(storage, providerId, {
        externalProductId: extId,
      }),
      vegan: fieldFromProvider(vegan, providerId, {
        externalProductId: extId,
      }),
      vegetarian: fieldFromProvider(vegetarian, providerId, {
        externalProductId: extId,
      }),
      palmOil: fieldFromProvider(palmOilNorm, providerId, {
        externalProductId: extId,
      }),
      pnnsGroup: fieldFromProvider(pnnsGroup, providerId, {
        externalProductId: extId,
      }),
      foodGroup: fieldFromProvider(foodGroup, providerId, {
        externalProductId: extId,
      }),
      nutrientLevels: fieldFromProvider(nutrientLevels, providerId, {
        externalProductId: extId,
      }),
      embCodes: fieldFromProvider(embCodes, providerId, {
        externalProductId: extId,
      }),
      producerLink: fieldFromProvider(producerLink, providerId, {
        externalProductId: extId,
      }),
      brandsAll: fieldFromProvider(brandsAll, providerId, {
        externalProductId: extId,
      }),
      completeness: fieldFromProvider(completeness, providerId, {
        externalProductId: extId,
      }),
      images,
      extraAttributes,
      specs,
      similarQuery: {
        brand,
        categoryTags: categoryTags.slice(0, 3),
        searchTerms: [brand, categories[0]].filter(Boolean).join(" ") || name,
      },
      rawSnapshot: slimSnapshot(product),
      sources: [
        {
          provider: providerId,
          externalProductId: extId,
          sourceUrl,
          fetchedAt,
        },
      ],
    };
  };

  return {
    getProviderName: () => providerId,
    getSupportedProductTypes: () =>
      providerId === "open_products_facts" ? ["general", "any"] : ["food", "any"],
    normaliseResponse,
    async getProductByBarcode(barcode: string): Promise<ProviderLookupResult> {
      const fetchedAt = new Date().toISOString();
      const cached = await getCachedLookup(providerId, barcode);
      if (cached) {
        if (cached.status === "miss") {
          return {
            provider: providerId,
            status: "miss",
            message: "Product not found.",
            fetchedAt: cached.retrievedAt,
            fromCache: true,
          };
        }
        if (cached.status === "hit") {
          const candidate = normaliseResponse(cached.payload, barcode);
          return {
            provider: providerId,
            status: candidate ? "hit" : "miss",
            candidate: candidate || null,
            externalProductId: candidate?.sources?.[0]?.externalProductId ?? null,
            sourceUrl: candidate?.sources?.[0]?.sourceUrl ?? null,
            fetchedAt: cached.retrievedAt,
            fromCache: true,
          };
        }
      }

      const gate = canCallProvider(providerId);
      if (!gate.ok) {
        return {
          provider: providerId,
          status: gate.reason === "circuit_open" ? "skipped" : "rate_limited",
          message:
            gate.reason === "circuit_open"
              ? "External product database temporarily unavailable."
              : "Product database temporarily busy. Try again shortly.",
          fetchedAt,
        };
      }

      const url = `${host}/api/v3/product/${encodeURIComponent(barcode)}`;
      try {
        const res = await fetchWithRetry(
          url,
          {
            headers: {
              "User-Agent": userAgent(),
              Accept: "application/json",
            },
          },
          { timeoutMs: 8_000, retries: 1 },
        );

        if (res.status === 404) {
          recordProviderSuccess(providerId);
          await setCachedLookup({
            provider: providerId,
            barcode,
            status: "miss",
            payload: { status: 0 },
          });
          return {
            provider: providerId,
            status: "miss",
            message: "Product not found.",
            fetchedAt,
          };
        }
        if (res.status === 429) {
          recordProviderFailure(providerId);
          return {
            provider: providerId,
            status: "rate_limited",
            message: "Product database temporarily busy. Try again shortly.",
            fetchedAt,
          };
        }
        if (!res.ok) {
          recordProviderFailure(providerId);
          await setCachedLookup({
            provider: providerId,
            barcode,
            status: "error",
            errorMessage: `HTTP ${res.status}`,
            ttlMs: 5 * 60_000,
          });
          return {
            provider: providerId,
            status: "error",
            message: "External product database unavailable.",
            fetchedAt,
          };
        }

        const json = await res.json();
        const candidate = normaliseResponse(json, barcode);
        if (!candidate) {
          recordProviderSuccess(providerId);
          await setCachedLookup({
            provider: providerId,
            barcode,
            status: "miss",
            payload: json,
          });
          return {
            provider: providerId,
            status: "miss",
            message: "Product not found.",
            fetchedAt,
          };
        }

        recordProviderSuccess(providerId);
        await setCachedLookup({
          provider: providerId,
          barcode,
          status: "hit",
          payload: json,
        });
        return {
          provider: providerId,
          status: "hit",
          candidate,
          externalProductId: candidate.sources?.[0]?.externalProductId ?? null,
          sourceUrl: candidate.sources?.[0]?.sourceUrl ?? null,
          fetchedAt,
        };
      } catch (err) {
        recordProviderFailure(providerId);
        const isTimeout =
          err instanceof Error && err.message.toLowerCase().includes("timeout");
        return {
          provider: providerId,
          status: isTimeout ? "timeout" : "error",
          message: isTimeout
            ? "Product lookup timed out."
            : "External product database unavailable.",
          fetchedAt,
        };
      }
    },

    async searchProduct(
      query: string,
      opts?: { pageSize?: number },
    ): Promise<ProviderLookupResult[]> {
      const q = query.trim();
      if (q.length < 2) return [];
      const fetchedAt = new Date().toISOString();
      const gate = canCallProvider(providerId);
      if (!gate.ok) return [];

      const pageSize = Math.min(Math.max(opts?.pageSize || 24, 1), 48);
      const url =
        `${host}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
        `&search_simple=1&action=process&json=1&page_size=${pageSize}`;

      try {
        const res = await fetchWithRetry(
          url,
          {
            headers: {
              "User-Agent": userAgent(),
              Accept: "application/json",
            },
          },
          { timeoutMs: 10_000, retries: 0 },
        );
        if (!res.ok) {
          recordProviderFailure(providerId);
          return [];
        }
        const json = (await res.json()) as { products?: unknown[] };
        recordProviderSuccess(providerId);
        const products = Array.isArray(json.products) ? json.products : [];
        const out: ProviderLookupResult[] = [];
        for (const p of products) {
          const code =
            p && typeof p === "object" && "code" in p
              ? String((p as { code?: string }).code || "")
              : "";
          const candidate = normaliseResponse({ product: p, status: 1 }, code);
          if (!candidate) continue;
          out.push({
            provider: providerId,
            status: "hit",
            candidate,
            externalProductId:
              candidate.sources?.[0]?.externalProductId ?? (code || null),
            sourceUrl: candidate.sources?.[0]?.sourceUrl ?? null,
            fetchedAt,
          });
        }
        return out;
      } catch {
        recordProviderFailure(providerId);
        return [];
      }
    },
  };
}

export const openFoodFactsProvider = createOpenFoodFactsProvider();
