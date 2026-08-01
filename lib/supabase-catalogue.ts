/**
 * Supabase-backed catalogue reads for the storefront.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { minorToMajor } from "@/lib/money";
import type { Product, ProductOffer } from "@/types";
import type { Category } from "@/types";

export type StorefrontProduct = Product & { offerCount?: number };
export type ProductDetail = Product & { offers: ProductOffer[] };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapProduct(row: Record<string, unknown>, categoryName?: string): Product {
  const images = Array.isArray(row.images)
    ? (row.images as string[])
    : row.image_url
      ? [String(row.image_url)]
      : [];
  return {
    id: String(row.public_id),
    name: String(row.name),
    description: String(row.description || ""),
    longDescription: row.long_description
      ? String(row.long_description)
      : String(row.description || ""),
    image: String(row.image_url || images[0] || ""),
    images,
    category: categoryName || "",
    status: (row.status as Product["status"]) || "published",
    rating: row.rating != null ? Number(row.rating) : undefined,
    reviewCount: row.review_count != null ? Number(row.review_count) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapOffer(
  row: Record<string, unknown>,
  vendor: {
    public_id: string;
    name: string;
    neighbourhood?: string | null;
    address_text?: string | null;
  },
  store?: { lat?: number | null; lng?: number | null; address_text?: string | null } | null,
): ProductOffer {
  const onHand = Number(row.on_hand || 0);
  const reserved = Number(row.reserved || 0);
  const moneyMinor = Number(row.price_minor || 0);
  return {
    id: String(row.public_id),
    productId: String(row.product_public_id || ""),
    vendorId: vendor.public_id,
    vendorName: vendor.name,
    neighbourhood: vendor.neighbourhood || undefined,
    address: store?.address_text || vendor.address_text || undefined,
    lng: store?.lng != null ? Number(store.lng) : undefined,
    lat: store?.lat != null ? Number(store.lat) : undefined,
    price: minorToMajor(moneyMinor),
    moneyMinor,
    onHand,
    reserved,
    stock: Math.max(0, onHand - reserved),
    status: (row.status as ProductOffer["status"]) || "published",
    barcode: row.barcode ? String(row.barcode) : undefined,
    gtin: row.gtin ? String(row.gtin) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export async function sbListCategories(): Promise<Category[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("categories")
    .select("id, public_id, slug, name, description, image_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const { data: products } = await sb
    .from("products")
    .select("category_id")
    .eq("status", "published")
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  for (const p of products || []) {
    if (!p.category_id) continue;
    counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
  }

  return (data || []).map((c) => ({
    id: c.public_id,
    name: c.name,
    slug: c.slug,
    description: c.description || undefined,
    image: c.image_url || undefined,
    productCount: counts.get(c.id) || 0,
  }));
}

export async function sbGetUnifiedCatalogue(): Promise<StorefrontProduct[]> {
  const sb = getServiceSupabase();
  const [{ data: products, error: pErr }, { data: offers, error: oErr }, { data: cats }] =
    await Promise.all([
      sb
        .from("products")
        .select("*, categories(name)")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      sb
        .from("product_offers")
        .select("product_id, public_id")
        .eq("status", "published")
        .is("deleted_at", null),
      sb.from("categories").select("id, name"),
    ]);
  if (pErr) throw pErr;
  if (oErr) throw oErr;

  const catById = new Map((cats || []).map((c) => [c.id, c.name]));
  const countByProductUuid = new Map<string, number>();
  for (const o of offers || []) {
    countByProductUuid.set(
      o.product_id,
      (countByProductUuid.get(o.product_id) || 0) + 1,
    );
  }

  return (products || []).map((row) => {
    const catName =
      (row as { categories?: { name?: string } }).categories?.name ||
      catById.get(row.category_id) ||
      "";
    const mapped = mapProduct(row as Record<string, unknown>, catName);
    return {
      ...mapped,
      offerCount: countByProductUuid.get(row.id) || 0,
      price: undefined,
      vendorName: undefined,
      neighbourhood: undefined,
      stock: undefined,
    };
  });
}

export async function sbGetProductDetail(
  publicId: string,
): Promise<ProductDetail | null> {
  const sb = getServiceSupabase();
  const { data: product, error } = await sb
    .from("products")
    .select("*, categories(name)")
    .eq("public_id", publicId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;

  const catName =
    (product as { categories?: { name?: string } }).categories?.name || "";

  const { data: offerRows, error: oErr } = await sb
    .from("product_offers")
    .select("*, vendors(public_id, name, neighbourhood, address_text, specialty), stores(lat, lng, address_text)")
    .eq("product_id", product.id)
    .eq("status", "published")
    .is("deleted_at", null);
  if (oErr) throw oErr;

  const offers: ProductOffer[] = (offerRows || []).map((row) => {
    const vendor = (row as {
      vendors: {
        public_id: string;
        name: string;
        neighbourhood?: string | null;
        address_text?: string | null;
      };
    }).vendors;
    const store = (row as {
      stores?: {
        lat?: number | null;
        lng?: number | null;
        address_text?: string | null;
      } | null;
    }).stores;
    return mapOffer(
      { ...row, product_public_id: product.public_id },
      vendor,
      store,
    );
  });

  return {
    ...mapProduct(product as Record<string, unknown>, catName),
    offers,
  };
}

export async function sbGetOfferByPublicId(
  offerPublicId: string,
): Promise<ProductOffer | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("product_offers")
    .select(
      "*, products(public_id), vendors(public_id, name, neighbourhood, address_text), stores(lat, lng, address_text)",
    )
    .eq("public_id", offerPublicId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const productPublicId = (data as { products?: { public_id?: string } }).products
    ?.public_id;
  const vendor = (data as {
    vendors: {
      public_id: string;
      name: string;
      neighbourhood?: string | null;
      address_text?: string | null;
    };
  }).vendors;
  const store = (data as {
    stores?: {
      lat?: number | null;
      lng?: number | null;
      address_text?: string | null;
    } | null;
  }).stores;
  return mapOffer(
    { ...data, product_public_id: productPublicId },
    vendor,
    store,
  );
}

export async function sbListAdmittedVendors() {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("vendors")
    .select(
      "public_id, slug, name, tagline, neighbourhood, address_text, specialty, stores(lat, lng, address_text, is_primary)",
    )
    .eq("status", "admitted")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;

  return (data || []).map((v) => {
    const stores = (v.stores as Array<{
      lat?: number | null;
      lng?: number | null;
      address_text?: string | null;
      is_primary?: boolean;
    }>) || [];
    const primary = stores.find((s) => s.is_primary) || stores[0];
    return {
      id: v.public_id,
      slug: v.slug,
      name: v.name,
      tagline: v.tagline || "",
      neighbourhood: v.neighbourhood || "",
      address: primary?.address_text || v.address_text || "",
      specialty: v.specialty || "",
      lng: primary?.lng != null ? Number(primary.lng) : undefined,
      lat: primary?.lat != null ? Number(primary.lat) : undefined,
    };
  });
}

export async function sbGetVendorBySlug(slug: string) {
  const list = await sbListAdmittedVendors();
  return list.find((v) => v.slug === slug) || null;
}

export async function sbListPublishedOffers(): Promise<ProductOffer[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("product_offers")
    .select(
      "*, products(public_id), vendors(public_id, name, neighbourhood, address_text), stores(lat, lng, address_text)",
    )
    .eq("status", "published")
    .is("deleted_at", null);
  if (error) throw error;
  return (data || []).map((row) => {
    const productPublicId = (row as { products?: { public_id?: string } })
      .products?.public_id;
    const vendor = (row as {
      vendors: {
        public_id: string;
        name: string;
        neighbourhood?: string | null;
        address_text?: string | null;
      };
    }).vendors;
    const store = (row as {
      stores?: {
        lat?: number | null;
        lng?: number | null;
        address_text?: string | null;
      } | null;
    }).stores;
    return mapOffer(
      { ...row, product_public_id: productPublicId },
      vendor,
      store,
    );
  });
}

export async function sbGetVendorStorefrontProducts(vendorPublicId: string) {
  const sb = getServiceSupabase();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id, public_id, name, neighbourhood")
    .eq("public_id", vendorPublicId)
    .maybeSingle();
  if (!vendor) return [];

  const { data: offers, error } = await sb
    .from("product_offers")
    .select(
      "*, products(*, categories(name)), vendors(public_id, name, neighbourhood, address_text), stores(lat, lng, address_text)",
    )
    .eq("vendor_id", vendor.id)
    .eq("status", "published")
    .is("deleted_at", null);
  if (error) throw error;

  return (offers || [])
    .map((row) => {
      const product = (row as { products?: Record<string, unknown> }).products;
      if (!product || product.status !== "published") return null;
      const catName =
        (product as { categories?: { name?: string } }).categories?.name || "";
      const mapped = mapProduct(product, catName);
      const vendorRow = (row as {
        vendors: {
          public_id: string;
          name: string;
          neighbourhood?: string | null;
          address_text?: string | null;
        };
      }).vendors;
      const store = (row as {
        stores?: {
          lat?: number | null;
          lng?: number | null;
          address_text?: string | null;
        } | null;
      }).stores;
      const offer = mapOffer(
        { ...row, product_public_id: product.public_id },
        vendorRow,
        store,
      );
      return {
        ...mapped,
        offerId: offer.id,
        price: offer.price,
        stock: offer.stock,
        vendorName: offer.vendorName,
        neighbourhood: offer.neighbourhood,
        vendorId: offer.vendorId,
      };
    })
    .filter(Boolean) as Array<
    Product & {
      offerId: string;
      price: number;
      stock: number;
      vendorName: string;
      neighbourhood?: string;
      vendorId: string;
    }
  >;
}

export async function sbListAdmittedVendorsDetailed() {
  const vendors = await sbListAdmittedVendors();
  const sb = getServiceSupabase();
  const { data: offers } = await sb
    .from("product_offers")
    .select("public_id, vendor_id, product_id, products(image_url, category_id, categories(name)), vendors(public_id)")
    .eq("status", "published")
    .is("deleted_at", null);

  const byVendorPublic = new Map<
    string,
    { count: number; categories: Set<string>; cover?: string }
  >();

  for (const o of offers || []) {
    const vPublic = (o as { vendors?: { public_id?: string } }).vendors
      ?.public_id;
    if (!vPublic) continue;
    const entry = byVendorPublic.get(vPublic) || {
      count: 0,
      categories: new Set<string>(),
    };
    entry.count += 1;
    const cat = (
      o as {
        products?: { categories?: { name?: string }; image_url?: string };
      }
    ).products?.categories?.name;
    if (cat) entry.categories.add(cat);
    if (!entry.cover) {
      entry.cover = (
        o as { products?: { image_url?: string } }
      ).products?.image_url;
    }
    byVendorPublic.set(vPublic, entry);
  }

  return vendors.map((v) => {
    const meta = byVendorPublic.get(v.id);
    return {
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighbourhood: v.neighbourhood,
      address: v.address,
      tagline: v.tagline || "Approved seller · click & collect",
      categories: [...(meta?.categories || [])].sort(),
      productCount: meta?.count || 0,
      coverImage: meta?.cover || "",
      status: "admitted" as const,
      lng: v.lng,
      lat: v.lat,
      specialty: v.specialty,
    };
  });
}

export { slugify };
