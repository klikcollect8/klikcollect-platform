/**
 * Server-only commerce map payload builder.
 * Client components must import from `@/lib/map-commerce-types` instead.
 */
import "server-only";

import { getAdmittedVendors } from "@/lib/admitted-vendors";
import { listPublishedOffers } from "@/lib/offers-store";
import { listProducts } from "@/lib/products-store";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { resolveProductImage } from "@/lib/product-image";
import {
  resolveVendorAddress,
  resolveVendorCoords,
  vendorById,
} from "@/lib/founding-vendors";
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
  await ensureNairobiSeed();
  const [admitted, offers, products] = await Promise.all([
    getAdmittedVendors(),
    listPublishedOffers(),
    listProducts(),
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
    const coords =
      v.lng != null && v.lat != null
        ? { lng: v.lng, lat: v.lat }
        : resolveVendorCoords({
            vendorId: v.id,
            neighbourhood: v.neighbourhood,
          });
    if (!coords) continue;

    const founding = vendorById(v.id);
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
          image: resolveProductImage(p.image),
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
          vendorIds: [v.id],
          minPrice: mp.price,
          maxPrice: mp.price,
        });
      }
    }

    const primaryCategory =
      v.categories[0] || founding?.specialty || "Groceries";
    const rating = stableRating(v.id);
    const pickupMinutes = pickupEta(v.id);

    vendors.push({
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighbourhood: v.neighbourhood,
      address:
        v.address ||
        resolveVendorAddress({
          vendorId: v.id,
          neighbourhood: v.neighbourhood,
        }) ||
        `${v.neighbourhood}, Nairobi`,
      tagline: v.tagline,
      categories: v.categories.length ? v.categories : [primaryCategory],
      primaryCategory,
      color: colorForCategory(primaryCategory),
      productCount: mappedProducts.length || v.productCount,
      coverImage: resolveProductImage(v.coverImage),
      lng: coords.lng,
      lat: coords.lat,
      rating,
      reviewCount: 18 + (Math.floor(stableRating(v.id) * 37) % 90),
      openNow: true,
      hoursLabel: "Open · closes 9:00 PM",
      pickupMinutes,
      deliveryMinutes: pickupMinutes + 20,
      deliveryFee: 150,
      minOrder: 500,
      verified: true,
      featured: mappedProducts.length >= 4,
      hasOffer: mappedProducts.some((p) => p.stock > 0 && p.price < 300),
      acceptsCard: true,
      acceptsMpesa: true,
      products: mappedProducts.slice(0, 8),
    });
  }

  return {
    vendors: vendors.sort((a, b) => a.name.localeCompare(b.name)),
    products: [...productIndex.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
