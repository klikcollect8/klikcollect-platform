import { slugify as baseSlugify } from "@/lib/supabase-catalogue";

export function productSlugify(name: string): string {
  return baseSlugify(name || "product").slice(0, 80) || "product";
}

export async function ensureUniqueProductSlug(
  desired: string,
  excludePublicId?: string,
  existsFn?: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = productSlugify(desired);
  if (!existsFn) return root;
  let candidate = root;
  let i = 2;
  while (await existsFn(candidate)) {
    // excludePublicId handled by caller query
    void excludePublicId;
    candidate = `${root}-${i}`.slice(0, 80);
    i += 1;
    if (i > 50) {
      candidate = `${root}-${Date.now().toString(36)}`.slice(0, 80);
      break;
    }
  }
  return candidate;
}
