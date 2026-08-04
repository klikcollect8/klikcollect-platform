import { sbListCategories } from "@/lib/supabase-catalogue";
import { V1_CATEGORIES } from "@/lib/curation-policy";

let cache: {
  at: number;
  map: Record<string, string>;
  cards: Array<{ name: string; image?: string; href: string }>;
} | null = null;
const TTL_MS = 60_000;

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  try {
    const cats = await sbListCategories();
    const map: Record<string, string> = {};
    for (const c of cats) {
      if (c.image) map[c.name] = c.image;
    }
    const cards = (
      cats.length ? cats.map((c) => c.name) : [...V1_CATEGORIES]
    ).map((name) => ({
      name,
      image: map[name],
      href: `/shop?category=${encodeURIComponent(name)}`,
    }));
    cache = { at: Date.now(), map, cards };
    return cache;
  } catch {
    const cards = V1_CATEGORIES.map((name) => ({
      name,
      image: undefined as string | undefined,
      href: `/shop?category=${encodeURIComponent(name)}`,
    }));
    cache = { at: Date.now(), map: {}, cards };
    return cache;
  }
}

/** Sync helper for client components - prefer async getCategoryImage when possible. */
export function categoryImage(name: string): string | undefined {
  if (cache?.map[name]) return cache.map[name];
  const match = cache
    ? Object.entries(cache.map).find(
        ([key]) => key.toLowerCase() === name.toLowerCase(),
      )
    : undefined;
  return match?.[1];
}

export async function getCategoryImage(
  name: string,
): Promise<string | undefined> {
  const data = await load();
  if (data.map[name]) return data.map[name];
  const match = Object.entries(data.map).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1];
}

export async function getCategoryCards() {
  const data = await load();
  return data.cards;
}

/** @deprecated Prefer getCategoryCards() - kept for sync SSR fallbacks */
export const CATEGORY_CARDS = V1_CATEGORIES.map((name) => ({
  name,
  image: undefined as string | undefined,
  href: `/shop?category=${encodeURIComponent(name)}`,
}));

/** Warm cache from server components */
export async function warmCategoryImageCache() {
  await load();
}
