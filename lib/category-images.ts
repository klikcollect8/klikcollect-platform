import { V1_CATEGORIES } from "@/lib/curation-policy";

/** Curated category card art from /public/categories */
export const CATEGORY_IMAGES: Record<string, string> = {
  Groceries: "/categories/groceries.jpeg",
  "General Essentials": "/categories/general-essentials.jpeg",
  "Fresh Produce": "/categories/fresh-produce.jpeg",
  Pantry: "/categories/pantry.jpeg",
  "Dairy & Eggs": "/categories/dairy-eggs.jpeg",
  Beverages: "/categories/beverages.jpeg",
  "Household Essentials": "/categories/household-essentials.jpeg",
  Snacks: "/categories/snacks.jpeg",
  "Home & Kitchen": "/categories/home-kitchen.jpeg",
  "Health & Wellness (non-prescription)": "/categories/health-wellness.jpeg",
};

export function categoryImage(name: string): string | undefined {
  if (CATEGORY_IMAGES[name]) return CATEGORY_IMAGES[name];
  const match = Object.entries(CATEGORY_IMAGES).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1];
}

export const CATEGORY_CARDS = V1_CATEGORIES.map((name) => ({
  name,
  image: CATEGORY_IMAGES[name],
  href: `/shop?category=${encodeURIComponent(name)}`,
}));
