/**
 * Storefront read path — unique products + vendor offers.
 */
import { listCatalogue, type CatalogueProduct } from "@/lib/catalogue-store";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { listProducts, getProductById } from "@/lib/products-store";
import {
  listOffersForProduct,
  listPublishedOffers,
  getOfferById,
} from "@/lib/offers-store";
import { resolveProductImage } from "@/lib/product-image";
import type { Product, ProductOffer } from "@/types";

export type StorefrontProduct = Product & {
  offerCount?: number;
};

export type ProductDetail = Product & {
  offers: ProductOffer[];
};

export async function getUnifiedCatalogue(): Promise<StorefrontProduct[]> {
  await ensureNairobiSeed();
  const [products, offers] = await Promise.all([
    listProducts(),
    listPublishedOffers(),
  ]);

  const countByProduct = new Map<string, number>();
  for (const o of offers) {
    countByProduct.set(o.productId, (countByProduct.get(o.productId) || 0) + 1);
  }

  return products.map((p) => ({
    ...p,
    image: resolveProductImage(p.image),
    images: Array.isArray(p.images)
      ? p.images.map((img) => resolveProductImage(img)).filter(Boolean)
      : [],
    offerCount: countByProduct.get(p.id) || 0,
    // Strip listing-facing price/vendor — lives on offers
    price: undefined,
    vendorName: undefined,
    neighbourhood: undefined,
    stock: undefined,
  }));
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  await ensureNairobiSeed();
  const product = await getProductById(id);
  if (!product || product.status !== "published") return null;

  const offers = (await listOffersForProduct(id)).map((o) => ({
    ...o,
  }));

  return {
    ...product,
    image: resolveProductImage(product.image),
    images: Array.isArray(product.images)
      ? product.images.map((img) => resolveProductImage(img)).filter(Boolean)
      : [],
    price: undefined,
    vendorName: undefined,
    neighbourhood: undefined,
    stock: undefined,
    offers,
    offerCount: offers.length,
  };
}

export async function getVendorCatalogue(
  vendorId: string,
): Promise<CatalogueProduct[]> {
  await ensureNairobiSeed();
  return listCatalogue(vendorId);
}

/** Products a vendor sells (canonical product + that vendor's offer price) */
export async function getVendorStorefrontProducts(vendorId: string): Promise<
  Array<Product & { offerId: string; price: number; stock: number; vendorName: string; neighbourhood?: string }>
> {
  await ensureNairobiSeed();
  const [products, offers] = await Promise.all([
    listProducts(),
    listPublishedOffers(),
  ]);
  const vendorOffers = offers.filter((o) => o.vendorId === vendorId);
  const byId = new Map(products.map((p) => [p.id, p]));

  return vendorOffers
    .map((o) => {
      const p = byId.get(o.productId);
      if (!p) return null;
      return {
        ...p,
        image: resolveProductImage(p.image),
        images: Array.isArray(p.images)
          ? p.images.map((img) => resolveProductImage(img)).filter(Boolean)
          : [],
        offerId: o.id,
        price: o.price,
        stock: o.stock,
        vendorName: o.vendorName,
        neighbourhood: o.neighbourhood,
        vendorId: o.vendorId,
      };
    })
    .filter(Boolean) as Array<
    Product & {
      offerId: string;
      price: number;
      stock: number;
      vendorName: string;
      neighbourhood?: string;
    }
  >;
}

export { getOfferById };
