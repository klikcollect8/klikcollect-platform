import { getServiceSupabase } from "@/lib/supabase/admin";
import type { ProviderId, ProviderLookupStatus } from "@/lib/product-resolver/types";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export async function getCachedLookup(
  provider: ProviderId,
  barcode: string,
): Promise<{
  status: ProviderLookupStatus;
  payload: unknown;
  retrievedAt: string;
} | null> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("provider_lookup_cache")
      .select("status, payload, retrieved_at, expires_at")
      .eq("provider", provider)
      .eq("barcode", barcode)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return {
      status: data.status as ProviderLookupStatus,
      payload: data.payload,
      retrievedAt: data.retrieved_at,
    };
  } catch {
    return null;
  }
}

export async function setCachedLookup(input: {
  provider: ProviderId;
  barcode: string;
  status: "hit" | "miss" | "error";
  payload?: unknown;
  errorMessage?: string | null;
  ttlMs?: number;
}): Promise<void> {
  try {
    const sb = getServiceSupabase();
    const now = new Date();
    const expires = new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS));
    await sb.from("provider_lookup_cache").upsert(
      {
        provider: input.provider,
        barcode: input.barcode,
        status: input.status,
        payload: input.payload ?? null,
        error_message: input.errorMessage ?? null,
        retrieved_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "provider,barcode" },
    );
  } catch (err) {
    console.error("[provider_lookup_cache]", err);
  }
}
