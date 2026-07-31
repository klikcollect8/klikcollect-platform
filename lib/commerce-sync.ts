/**
 * Catalogue/orders sync toward Supabase (Phase A start).
 *
 * Local `.data` remains the M1 write path. When SUPABASE_SERVICE_ROLE_KEY
 * is present and COMMERCE_SYNC_ENABLED=true, push catalogue rows upstream.
 * Reads stay on getUnifiedCatalogue() until the flip in Phase C.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listCatalogue, type CatalogueProduct } from "@/lib/catalogue-store";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isCommerceSyncEnabled() {
  return process.env.COMMERCE_SYNC_ENABLED === "true";
}

export type SyncResult = {
  attempted: boolean;
  synced: number;
  error?: string;
};

export async function syncCatalogueToSupabase(
  vendorId?: string,
): Promise<SyncResult> {
  if (!isCommerceSyncEnabled()) {
    return { attempted: false, synced: 0 };
  }
  const sb = serviceClient();
  if (!sb) {
    return {
      attempted: true,
      synced: 0,
      error: "Missing Supabase service role credentials",
    };
  }

  const rows = await listCatalogue(vendorId);
  if (!rows.length) return { attempted: true, synced: 0 };

  const payload = rows.map((p: CatalogueProduct) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    money_minor: p.moneyMinor,
    image: p.image,
    category: p.category,
    stock: p.stock,
    status: p.status || "published",
    vendor_id: p.vendorId,
    neighbourhood: p.neighbourhood || null,
    source: "os_catalogue",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await sb.from("products").upsert(payload, { onConflict: "id" });
  if (error) {
    return { attempted: true, synced: 0, error: error.message };
  }
  return { attempted: true, synced: payload.length };
}
