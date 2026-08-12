import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { mergeProviderResults, candidateCompleteness } from "@/lib/product-resolver/merge";
import {
  findLocalProductByBarcode,
  klikCollectProvider,
} from "@/lib/product-resolver/providers/klikcollect";
import { openFoodFactsProvider } from "@/lib/product-resolver/providers/open-food-facts";
import { openProductsFactsProvider } from "@/lib/product-resolver/providers/open-products-facts";
import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import type {
  ProviderId,
  ProviderLookupResult,
  ResolveResult,
  ResolutionStatus,
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

export async function resolveBarcode(input: {
  barcode: string;
  formatHint?: string | null;
  actorClerkUserId?: string | null;
  actorEmail?: string | null;
  skipExternal?: boolean;
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
  const providerResults: ProviderLookupResult[] = [];

  // Parallel external lookups
  const settled = await Promise.all(
    providers.map((p) => p.getProductByBarcode(barcode)),
  );
  providerResults.push(...settled);

  const candidate = mergeProviderResults(
    barcode,
    normalised.format,
    providerResults,
  );
  const completeness = candidateCompleteness(candidate);
  let resolutionStatus: ResolutionStatus = "not_found";
  let message =
    "Barcode found, product information unavailable.";

  if (candidate && completeness.filled >= 3) {
    resolutionStatus = "external_found";
    message = "Product found in product databases.";
  } else if (candidate && completeness.filled > 0) {
    resolutionStatus = "partial";
    message = "Partial product information found. Review carefully.";
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

export function listConfiguredProviders(): ProviderId[] {
  return providerOrder().map((p) => p.getProviderName());
}
