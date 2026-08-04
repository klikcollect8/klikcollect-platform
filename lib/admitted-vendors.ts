/**
 * Public storefront vendors - admitted vendors from Supabase.
 */
import {
  sbGetVendorStorefrontProducts,
  sbListAdmittedVendorsDetailed,
} from "@/lib/supabase-catalogue";
import { productImageUrl } from "@/lib/storage-urls";

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
  const rows = await sbListAdmittedVendorsDetailed();
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    neighbourhood: v.neighbourhood,
    address: v.address,
    tagline: v.tagline,
    categories: v.categories,
    productCount: v.productCount,
    coverImage: v.coverImage || productImageUrl("sourdough-loaf.jpeg"),
    status: "admitted" as const,
    lng: v.lng,
    lat: v.lat,
  }));
}

export async function getAdmittedVendorBySlug(
  slug: string,
): Promise<AdmittedVendor | null> {
  const all = await getAdmittedVendors();
  return all.find((v) => v.slug === slug) || null;
}

export async function getVendorProducts(vendor: { id: string; name: string }) {
  return sbGetVendorStorefrontProducts(vendor.id);
}
