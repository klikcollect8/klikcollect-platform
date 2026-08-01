/**
 * Server-only commerce map payload builder.
 * Client components must import from `@/lib/map-commerce-types` instead.
 */
import "server-only";

import { getAdmittedVendors } from "@/lib/admitted-vendors";
import { listPublishedOffers, getUnifiedCatalogue } from "@/lib/commerce-truth";
import { colorForCategory } from "@/lib/mapbox";
import type {
  MapCommerceProduct,
  MapCommerceVendor,
  MapProductIndexEntry,
} from "@/lib/map-commerce-types";

export type {
  MapCommerceProduct,
  MapCommerceVendor,
  MapProductIndexEntry,
} from "@/lib/map-commerce-types";

function stableRating(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Math.round((3.9 + (h % 11) / 10) * 10) / 10;
}

function pickupEta(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) >>> 0;
  return 15 + (h % 6) * 5;
}

export async function getMapCommercePayload(): Promise<{
  vendors: MapCommerceVendor[];
  products: MapProductIndexEntry[];
}> {
  const [admitted, offers, products] = await Promise.all([
    getAdmittedVendors(),
    listPublishedOffers(),
    getUnifiedCatalogue(),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const offersByVendor = new Map<string, typeof offers>();
  for (const o of offers) {
    const list = offersByVendor.get(o.vendorId) || [];
    list.push(o);
    offersByVendor.set(o.vendorId, list);
  }

  const vendors: MapCommerceVendor[] = [];
  const productIndex = new Map<string, MapProductIndexEntry>();

  for (const v of admitted) {
    if (v.lng == null || v.lat == null) continue;

    const vendorOffers = offersByVendor.get(v.id) || [];
    const mappedProducts: MapCommerceProduct[] = vendorOffers
      .map((o) => {
        const p = productById.get(o.productId);
        if (!p || p.status !== "published") return null;
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          price: o.price,
          stock: o.stock,
          image: p.image,
        };
      })
      .filter(Boolean) as MapCommerceProduct[];

    for (const mp of mappedProducts) {
      const existing = productIndex.get(mp.id);
      if (existing) {
        if (!existing.vendorIds.includes(v.id)) existing.vendorIds.push(v.id);
        existing.minPrice = Math.min(existing.minPrice, mp.price);
        existing.maxPrice = Math.max(existing.maxPrice, mp.price);
      } else {
        productIndex.set(mp.id, {
          id: mp.id,
          name: mp.name,
          category: mp.category,
          image: mp.image,
          minPrice: mp.price,
          maxPrice: mp.price,
          vendorIds: [v.id],
        });
      }
    }

    const topCategory = mappedProducts[0]?.category || "Groceries";
    const categories = [
      ...new Set(mappedProducts.map((p) => p.category).filter(Boolean)),
    ];
    vendors.push({
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighbourhood: v.neighbourhood,
      address: v.address || v.neighbourhood,
      tagline: v.tagline,
      categories: categories.length ? categories : v.categories,
      primaryCategory: topCategory,
      color: colorForCategory(topCategory),
      productCount: mappedProducts.length,
      coverImage: mappedProducts[0]?.image || v.coverImage,
      lng: v.lng,
      lat: v.lat,
      rating: stableRating(v.id),
      reviewCount: mappedProducts.length * 3,
      openNow: true,
      hoursLabel: "Open · closes 8pm",
      pickupMinutes: pickupEta(v.id),
      deliveryMinutes: pickupEta(v.id) + 20,
      deliveryFee: 0,
      minOrder: 0,
      verified: true,
      featured: mappedProducts.length >= 8,
      hasOffer: mappedProducts.length > 0,
      acceptsCard: true,
      acceptsMpesa: true,
      products: mappedProducts,
    });
  }

  return {
    vendors,
    products: [...productIndex.values()],
  };
}
