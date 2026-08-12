import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import { emptyField, fieldFromProvider } from "@/lib/product-resolver/field";
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
    const brand =
      typeof product.brands === "string"
        ? product.brands.split(",")[0]?.trim() || null
        : null;
    const genericName = pickLang(product, "generic_name");
    const quantity =
      typeof product.quantity === "string" ? product.quantity : null;
    const ingredients =
      pickLang(product, "ingredients_text") ||
      (typeof product.ingredients_text === "string"
        ? product.ingredients_text
        : null);
    const allergens =
      typeof product.allergens_tags === "object"
        ? asStringArray(product.allergens_tags).join(", ")
        : typeof product.allergens === "string"
          ? product.allergens
          : null;
    const additives = asStringArray(product.additives_tags).join(", ") || null;
    const traces =
      typeof product.traces === "string"
        ? product.traces
        : asStringArray(product.traces_tags).join(", ") || null;
    const nutriscore =
      typeof product.nutriscore_grade === "string"
        ? product.nutriscore_grade.toUpperCase()
        : typeof product.nutrition_grades === "string"
          ? product.nutrition_grades.toUpperCase()
          : null;
    const labels = asStringArray(product.labels_tags || product.labels);
    const categories = asStringArray(
      product.categories_tags || product.categories,
    );
    const countries = asStringArray(
      product.countries_tags || product.countries,
    );
    const packaging =
      typeof product.packaging === "string" ? product.packaging : null;
    const manufacturer =
      typeof product.manufacturing_places === "string"
        ? product.manufacturing_places
        : null;
    const servingSize =
      typeof product.serving_size === "string" ? product.serving_size : null;
    const nutrition =
      product.nutriments && typeof product.nutriments === "object"
        ? (product.nutriments as Record<string, unknown>)
        : null;

    const images: CandidateImage[] = [];
    const pushImg = (
      url: unknown,
      role: CandidateImage["role"],
    ) => {
      if (typeof url === "string" && url.startsWith("http")) {
        images.push({
          url,
          role,
          provider: providerId,
          sourceUrl: url,
        });
      }
    };
    pushImg(product.image_front_url || product.image_url, "front");
    pushImg(product.image_ingredients_url, "ingredients");
    pushImg(product.image_nutrition_url, "nutrition");
    pushImg(product.image_packaging_url, "packaging");

    const fetchedAt = new Date().toISOString();
    const sourceUrl = `${host}/product/${encodeURIComponent(extId)}`;

    return {
      barcode,
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
      unit: emptyField(),
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
      packaging: fieldFromProvider(packaging, providerId, {
        externalProductId: extId,
      }),
      manufacturer: fieldFromProvider(manufacturer, providerId, {
        externalProductId: extId,
      }),
      servingSize: fieldFromProvider(servingSize, providerId, {
        externalProductId: extId,
      }),
      images,
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
  };
}

export const openFoodFactsProvider = createOpenFoodFactsProvider();
