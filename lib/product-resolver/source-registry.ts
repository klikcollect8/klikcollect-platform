/**
 * Dynamic product-source registry + health probes.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import type { ProviderId } from "@/lib/product-resolver/types";
import {
  klikCollectProvider,
} from "@/lib/product-resolver/providers/klikcollect";
import { openFoodFactsProvider } from "@/lib/product-resolver/providers/open-food-facts";
import { openProductsFactsProvider } from "@/lib/product-resolver/providers/open-products-facts";
import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import { withTimeout } from "@/lib/product-resolver/rate-limit";

export type SourceRegistryRow = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  isLocal: boolean;
  priority: number;
  healthStatus: string;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  meta: Record<string, unknown>;
};

const PROVIDER_IMPL: Record<string, ProductDataProvider> = {
  klikcollect: klikCollectProvider,
  open_food_facts: openFoodFactsProvider,
  open_products_facts: openProductsFactsProvider,
};

const DISPLAY: Record<string, string> = {
  klikcollect: "KlikCollect",
  open_food_facts: "Open Food Facts",
  open_products_facts: "Open Products Facts",
};

function mapRow(row: Record<string, unknown>): SourceRegistryRow {
  return {
    providerId: String(row.provider_id),
    displayName: String(row.display_name || row.provider_id),
    enabled: Boolean(row.enabled),
    isLocal: Boolean(row.is_local),
    priority: Number(row.priority || 100),
    healthStatus: String(row.health_status || "unknown"),
    lastOkAt: (row.last_ok_at as string) || null,
    lastErrorAt: (row.last_error_at as string) || null,
    lastError: (row.last_error as string) || null,
    consecutiveFailures: Number(row.consecutive_failures || 0),
    meta: (row.meta as Record<string, unknown>) || {},
  };
}

async function ensureSeeded() {
  const sb = getServiceSupabase();
  const { count } = await sb
    .from("product_source_registry")
    .select("id", { count: "exact", head: true });
  if ((count || 0) > 0) return;
  await sb.from("product_source_registry").upsert(
    [
      {
        provider_id: "klikcollect",
        display_name: "KlikCollect",
        enabled: true,
        is_local: true,
        priority: 10,
        health_status: "healthy",
      },
      {
        provider_id: "open_food_facts",
        display_name: "Open Food Facts",
        enabled: true,
        is_local: false,
        priority: 20,
      },
      {
        provider_id: "open_products_facts",
        display_name: "Open Products Facts",
        enabled: true,
        is_local: false,
        priority: 30,
      },
    ],
    { onConflict: "provider_id" },
  );
}

export async function listSourceRegistry(): Promise<SourceRegistryRow[]> {
  try {
    await ensureSeeded();
    const sb = getServiceSupabase();
    const { data, error } = await sb
      .from("product_source_registry")
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => mapRow(r as Record<string, unknown>));
  } catch (err) {
    console.warn("[source-registry] fallback to static", err);
    return Object.keys(PROVIDER_IMPL).map((id, i) => ({
      providerId: id,
      displayName: DISPLAY[id] || id,
      enabled: true,
      isLocal: id === "klikcollect",
      priority: (i + 1) * 10,
      healthStatus: "unknown",
      lastOkAt: null,
      lastErrorAt: null,
      lastError: null,
      consecutiveFailures: 0,
      meta: {},
    }));
  }
}

/** Providers for resolve, respecting registry enable + priority (env order still applied as secondary). */
export async function getOrderedProviders(): Promise<ProductDataProvider[]> {
  const registry = await listSourceRegistry();
  const envRaw = process.env.PRODUCT_RESOLVER_PROVIDER_ORDER || "";
  const envOrder = envRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const enabled = registry.filter((r) => r.enabled);
  enabled.sort((a, b) => {
    if (envOrder.length) {
      const ai = envOrder.indexOf(a.providerId);
      const bi = envOrder.indexOf(b.providerId);
      if (ai >= 0 || bi >= 0) {
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      }
    }
    return a.priority - b.priority;
  });

  return enabled
    .map((r) => PROVIDER_IMPL[r.providerId])
    .filter(Boolean);
}

export async function updateSourceRegistry(input: {
  providerId: string;
  enabled?: boolean;
  priority?: number;
  displayName?: string;
}): Promise<SourceRegistryRow | null> {
  await ensureSeeded();
  const sb = getServiceSupabase();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.enabled === "boolean") {
    patch.enabled = input.enabled;
    if (!input.enabled) patch.health_status = "disabled";
  }
  if (typeof input.priority === "number") patch.priority = input.priority;
  if (input.displayName) patch.display_name = input.displayName;

  const { data, error } = await sb
    .from("product_source_registry")
    .update(patch)
    .eq("provider_id", input.providerId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function recordSourceHealth(input: {
  providerId: string;
  ok: boolean;
  error?: string | null;
}) {
  try {
    await ensureSeeded();
    const sb = getServiceSupabase();
    const { data: row } = await sb
      .from("product_source_registry")
      .select("consecutive_failures")
      .eq("provider_id", input.providerId)
      .maybeSingle();
    if (!row) return;

    if (input.ok) {
      await sb
        .from("product_source_registry")
        .update({
          health_status: "healthy",
          last_ok_at: new Date().toISOString(),
          consecutive_failures: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_id", input.providerId);
    } else {
      const fails = Number(row.consecutive_failures || 0) + 1;
      await sb
        .from("product_source_registry")
        .update({
          health_status: fails >= 3 ? "down" : "degraded",
          last_error_at: new Date().toISOString(),
          last_error: input.error || "probe failed",
          consecutive_failures: fails,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_id", input.providerId);
    }
  } catch (err) {
    console.warn("[source-registry] health write failed", err);
  }
}

/** Probe each non-local provider with a known-safe barcode lookup. */
export async function probeSourceHealth(): Promise<{
  results: Array<{
    providerId: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
  }>;
}> {
  const registry = await listSourceRegistry();
  const results: Array<{
    providerId: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
  }> = [];

  // Use a well-known barcode that OFF typically has (Nutella) — miss is still "reachable"
  const probeBarcode = "3017620422003";

  for (const row of registry) {
    if (!row.enabled) {
      results.push({
        providerId: row.providerId,
        ok: false,
        latencyMs: 0,
        error: "disabled",
      });
      continue;
    }
    if (row.isLocal) {
      await recordSourceHealth({ providerId: row.providerId, ok: true });
      results.push({ providerId: row.providerId, ok: true, latencyMs: 0 });
      continue;
    }
    const impl = PROVIDER_IMPL[row.providerId];
    if (!impl) {
      results.push({
        providerId: row.providerId,
        ok: false,
        latencyMs: 0,
        error: "no implementation",
      });
      continue;
    }
    const t0 = Date.now();
    try {
      await withTimeout(impl.getProductByBarcode(probeBarcode), 8000, "probe_timeout");
      const latencyMs = Date.now() - t0;
      await recordSourceHealth({ providerId: row.providerId, ok: true });
      results.push({ providerId: row.providerId, ok: true, latencyMs });
    } catch (e) {
      const latencyMs = Date.now() - t0;
      const error = e instanceof Error ? e.message : "probe failed";
      await recordSourceHealth({
        providerId: row.providerId,
        ok: false,
        error,
      });
      results.push({ providerId: row.providerId, ok: false, latencyMs, error });
    }
  }

  return { results };
}

export function providerImpl(id: ProviderId | string): ProductDataProvider | null {
  return PROVIDER_IMPL[id] || null;
}
