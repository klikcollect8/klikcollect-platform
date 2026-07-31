/**
 * Public storefront vendors — admitted curation applications only.
 */
import { listApplications } from "@/lib/m1-store";
import { listProducts } from "@/lib/products-store";
import { listPublishedOffers } from "@/lib/offers-store";
import { FOUNDING_VENDORS } from "@/lib/founding-vendors";
import { resolveVendorSlug } from "@/lib/vendor-slug";
import { resolveProductImage } from "@/lib/product-image";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { getVendorStorefrontProducts } from "@/lib/commerce-truth";

export type AdmittedVendor = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  address?: string;
  tagline: string;
  email?: string;
  categories: string[];
  productCount: number;
  coverImage: string;
  status: "admitted";
  lng?: number;
  lat?: number;
};

export async function getAdmittedVendors(): Promise<AdmittedVendor[]> {
  await ensureNairobiSeed();
  const [apps, products, offers] = await Promise.all([
    listApplications(),
    listProducts(),
    listPublishedOffers(),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const admitted = apps.filter((a) => a.status === "admitted");
  const byId = new Map<string, AdmittedVendor>();

  for (const app of admitted) {
    const founding = FOUNDING_VENDORS.find(
      (v) =>
        v.id === app.id ||
        v.name.toLowerCase() === app.businessName.trim().toLowerCase(),
    );
    const id = founding?.id || app.id;
    const name = founding?.name || app.businessName;
    const slug = resolveVendorSlug({ id, name });
    const vendorOffers = offers.filter((o) => o.vendorId === id);
    const categories = [
      ...new Set(
        vendorOffers
          .map((o) => productById.get(o.productId)?.category)
          .filter(Boolean) as string[],
      ),
    ].sort();
    const coverProduct = vendorOffers
      .map((o) => productById.get(o.productId))
      .find((p) => p?.image);
    const cover =
      coverProduct?.image ||
      `/products/sourdough-loaf.jpeg`;

    byId.set(id, {
      id,
      name,
      slug,
      neighbourhood: founding?.neighbourhood || app.neighbourhood || "Nairobi",
      address: founding?.address,
      tagline:
        founding?.tagline ||
        app.notes ||
        app.decision?.reason ||
        "Approved seller · click & collect",
      email: founding?.email || app.contactEmail,
      categories,
      productCount: vendorOffers.length,
      coverImage: resolveProductImage(cover),
      status: "admitted",
      lng: founding?.lng,
      lat: founding?.lat,
    });
  }

  for (const v of FOUNDING_VENDORS) {
    if (byId.has(v.id)) continue;
    const vendorOffers = offers.filter((o) => o.vendorId === v.id);
    if (!vendorOffers.length) continue;
    const categories = [
      ...new Set(
        vendorOffers
          .map((o) => productById.get(o.productId)?.category)
          .filter(Boolean) as string[],
      ),
    ].sort();
    const coverProduct = vendorOffers
      .map((o) => productById.get(o.productId))
      .find((p) => p?.image);
    byId.set(v.id, {
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighbourhood: v.neighbourhood,
      address: v.address,
      tagline: v.tagline,
      email: v.email,
      categories,
      productCount: vendorOffers.length,
      coverImage: resolveProductImage(
        coverProduct?.image || "/products/sourdough-loaf.jpeg",
      ),
      status: "admitted",
      lng: v.lng,
      lat: v.lat,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAdmittedVendorBySlug(
  slug: string,
): Promise<AdmittedVendor | null> {
  const all = await getAdmittedVendors();
  return all.find((v) => v.slug === slug) || null;
}

export async function getVendorProducts(vendor: { id: string; name: string }) {
  return getVendorStorefrontProducts(vendor.id);
}
