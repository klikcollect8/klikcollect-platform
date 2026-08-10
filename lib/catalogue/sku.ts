import { slugify } from "@/lib/supabase-catalogue";

/** Generate a unique-ish SKU from product name + optional suffix. */
export function generateSku(name: string, suffix?: string): string {
  const base = slugify(name || "product")
    .replace(/-/g, "")
    .toUpperCase()
    .slice(0, 10);
  const tail = (suffix || Math.random().toString(36).slice(2, 6)).toUpperCase();
  return `${base || "PRD"}-${tail}`.slice(0, 32);
}

export function generateVariantSku(parentSku: string, options: Record<string, string>): string {
  const parts = Object.values(options)
    .map((v) =>
      String(v)
        .replace(/[^a-z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 4),
    )
    .filter(Boolean);
  return `${parentSku}-${parts.join("-") || "VAR"}`.slice(0, 40);
}
