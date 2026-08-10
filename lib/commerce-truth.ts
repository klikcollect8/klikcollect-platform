/**
 * Storefront read path - unique products + vendor offers (Supabase).
 */
import { unstable_cache } from "next/cache";
import {
  sbGetOfferByPublicId,
  sbGetProductDetail,
  sbGetUnifiedCatalogue,
  sbGetVendorStorefrontProducts,
  sbListCategories,
  sbListPublishedOffers,
  type ProductDetail,
  type StorefrontProduct,
} from "@/lib/supabase-catalogue";
import type { Category, Product, ProductOffer } from "@/types";

export type { StorefrontProduct, ProductDetail };

const getCachedCatalogue = unstable_cache(
  async () => sbGetUnifiedCatalogue(),
  ["unified-catalogue-v1"],
  { revalidate: 60, tags: ["catalogue"] },
);

const getCachedCategories = unstable_cache(
  async () => sbListCategories(),
  ["categories-v1"],
  { revalidate: 120, tags: ["categories"] },
);

export async function getUnifiedCatalogue(): Promise<StorefrontProduct[]> {
  return getCachedCatalogue();
}

/** Slim home payload — fewer cards, shared cache. */
export async function getHomeCatalogue(limit = 40): Promise<{
  products: StorefrontProduct[];
  categories: Category[];
}> {
  const [products, categories] = await Promise.all([
    getCachedCatalogue(),
    getCachedCategories(),
  ]);
  return {
    products: products.slice(0, limit),
    categories: categories.slice(0, 12),
  };
}

export async function getProductDetail(
  id: string,
): Promise<ProductDetail | null> {
  return sbGetProductDetail(id);
}

export async function getOffer(offerId: string): Promise<ProductOffer | null> {
  return sbGetOfferByPublicId(offerId);
}

export async function getOfferById(
  offerId: string,
): Promise<ProductOffer | null> {
  return sbGetOfferByPublicId(offerId);
}

export async function listPublishedOffers(): Promise<ProductOffer[]> {
  return sbListPublishedOffers();
}

/** Products a vendor sells (canonical product + that vendor's offer price) */
export async function getVendorStorefrontProducts(vendorId: string): Promise<
  Array<
    Product & {
      offerId: string;
      price: number;
      stock: number;
      vendorName: string;
      neighbourhood?: string;
      vendorId: string;
    }
  >
> {
  return sbGetVendorStorefrontProducts(vendorId);
}
