/**
 * Storefront read path - unique products + vendor offers (Supabase).
 */
import {
  sbGetOfferByPublicId,
  sbGetProductDetail,
  sbGetUnifiedCatalogue,
  sbGetVendorStorefrontProducts,
  sbListPublishedOffers,
  type ProductDetail,
  type StorefrontProduct,
} from "@/lib/supabase-catalogue";
import type { Product, ProductOffer } from "@/types";

export type { StorefrontProduct, ProductDetail };

export async function getUnifiedCatalogue(): Promise<StorefrontProduct[]> {
  return sbGetUnifiedCatalogue();
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
