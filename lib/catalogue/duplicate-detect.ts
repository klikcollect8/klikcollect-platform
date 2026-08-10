import { getServiceSupabase } from "@/lib/supabase/admin";

export type DuplicateMatch = {
  publicId: string;
  name: string;
  brandName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  reason: string;
};

function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findDuplicateProducts(input: {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  brandName?: string | null;
  excludePublicId?: string | null;
}): Promise<DuplicateMatch[]> {
  const sb = getServiceSupabase();
  const matches = new Map<string, DuplicateMatch>();

  const push = (row: Record<string, unknown>, reason: string) => {
    const publicId = String(row.public_id || "");
    if (!publicId) return;
    if (input.excludePublicId && publicId === input.excludePublicId) return;
    if (matches.has(publicId)) return;
    matches.set(publicId, {
      publicId,
      name: String(row.name || ""),
      sku: (row.sku as string) || null,
      barcode: (row.barcode as string) || (row.gtin as string) || null,
      reason,
    });
  };

  if (input.barcode) {
    const { data } = await sb
      .from("products")
      .select("public_id, name, sku, barcode, gtin")
      .or(`barcode.eq.${input.barcode},gtin.eq.${input.barcode}`)
      .is("deleted_at", null)
      .limit(10);
    for (const row of data || []) push(row, "Matching barcode / GTIN");
  }

  if (input.gtin && input.gtin !== input.barcode) {
    const { data } = await sb
      .from("products")
      .select("public_id, name, sku, barcode, gtin")
      .eq("gtin", input.gtin)
      .is("deleted_at", null)
      .limit(10);
    for (const row of data || []) push(row, "Matching GTIN");
  }

  if (input.sku) {
    const { data } = await sb
      .from("products")
      .select("public_id, name, sku, barcode, gtin")
      .eq("sku", input.sku)
      .is("deleted_at", null)
      .limit(10);
    for (const row of data || []) push(row, "Matching SKU");
  }

  if (input.mpn) {
    const { data } = await sb
      .from("products")
      .select("public_id, name, sku, barcode, gtin")
      .eq("mpn", input.mpn)
      .is("deleted_at", null)
      .limit(10);
    for (const row of data || []) push(row, "Matching manufacturer part number");
  }

  if (input.name) {
    const norm = normalizeName(input.name);
    if (norm.length >= 4) {
      const { data } = await sb
        .from("products")
        .select("public_id, name, sku, barcode, gtin")
        .ilike("name", `%${input.name.slice(0, 40)}%`)
        .is("deleted_at", null)
        .limit(20);
      for (const row of data || []) {
        const other = normalizeName(String(row.name || ""));
        if (other === norm) push(row, "Exact normalized name match");
        else if (other.includes(norm) || norm.includes(other)) {
          push(row, "Similar product name");
        }
      }
    }
  }

  return [...matches.values()].slice(0, 12);
}
