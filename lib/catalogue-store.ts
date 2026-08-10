/**
 * Vendor OS catalogue - flattened offer rows from Supabase.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { minorToMajor } from "@/lib/money";
import type { Product } from "@/types";

export type CatalogueProduct = Product & {
  vendorId?: string;
  vendorName?: string;
  neighbourhood?: string;
  price?: number;
  moneyMinor?: number;
  onHand?: number;
  reserved?: number;
  stock?: number;
  barcode?: string;
  gtin?: string;
};

export async function listCatalogue(
  vendorPublicId?: string,
): Promise<CatalogueProduct[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from("product_offers")
    .select(
      "*, products(*, categories(name)), vendors(public_id, name, neighbourhood)",
    )
    .is("deleted_at", null);

  if (vendorPublicId) {
    const { data: vendor } = await sb
      .from("vendors")
      .select("id")
      .eq("public_id", vendorPublicId)
      .maybeSingle();
    if (!vendor) return [];
    // Vendor workspace: include paused (draft) offers for Pause/Resume controls.
    q = q.eq("vendor_id", vendor.id).in("status", ["published", "draft"]);
  } else {
    q = q.eq("status", "published");
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((row) => {
    const product = (row as { products: Record<string, unknown> }).products;
    const vendor = (
      row as {
        vendors: {
          public_id: string;
          name: string;
          neighbourhood?: string | null;
        };
      }
    ).vendors;
    const cat =
      (product as { categories?: { name?: string } }).categories?.name || "";
    const onHand = Number(row.on_hand || 0);
    const reserved = Number(row.reserved || 0);
    const moneyMinor = Number(row.price_minor || 0);
    const image = String(product.image_url || "");
    return {
      id: String(row.public_id),
      name: String(product.name),
      description: String(product.description || ""),
      longDescription: String(
        product.long_description || product.description || "",
      ),
      image,
      images: Array.isArray(product.images)
        ? (product.images as string[])
        : [image],
      category: cat,
      status: (String(row.status || "published") === "draft"
        ? "draft"
        : String(row.status) === "archived"
          ? "archived"
          : "published") as CatalogueProduct["status"],
      vendorId: vendor.public_id,
      vendorName: vendor.name,
      neighbourhood: vendor.neighbourhood || undefined,
      price: minorToMajor(moneyMinor),
      moneyMinor,
      onHand,
      reserved,
      stock: Math.max(0, onHand - reserved),
      barcode: row.barcode ? String(row.barcode) : undefined,
      gtin: row.gtin ? String(row.gtin) : undefined,
      badges: onHand - reserved <= 5 ? ["Low stock"] : [],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });
}

export async function getCatalogueProduct(
  id: string,
): Promise<CatalogueProduct | null> {
  const all = await listCatalogue();
  return all.find((p) => p.id === id) || null;
}

export async function saveCatalogue(_products: CatalogueProduct[]) {
  // Writes go through product_offers APIs - no-op for compatibility
}

export async function mutateCatalogueProduct(
  offerPublicId: string,
  patch: Partial<Pick<CatalogueProduct, "onHand" | "reserved" | "stock">>,
): Promise<CatalogueProduct | null> {
  const sb = getServiceSupabase();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.onHand != null) update.on_hand = patch.onHand;
  if (patch.reserved != null) update.reserved = patch.reserved;
  const { error } = await sb
    .from("product_offers")
    .update(update)
    .eq("public_id", offerPublicId);
  if (error) throw error;
  return getCatalogueProduct(offerPublicId);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function setProductBarcode(
  offerPublicId: string,
  gtin: string,
): Promise<CatalogueProduct | null> {
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("product_offers")
    .update({
      barcode: gtin,
      gtin,
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", offerPublicId);
  if (error) throw error;
  return getCatalogueProduct(offerPublicId);
}

export async function updateCatalogueStatus(
  offerPublicIds: string[],
  status: Product["status"],
): Promise<number> {
  const sb = getServiceSupabase();
  const offerStatus = status === "published" ? "published" : "archived";
  const { data, error } = await sb
    .from("product_offers")
    .update({ status: offerStatus, updated_at: new Date().toISOString() })
    .in("public_id", offerPublicIds)
    .select("id");
  if (error) throw error;
  return data?.length || 0;
}

export async function addCatalogueProduct(input: {
  name: string;
  category: string;
  priceMajor: number;
  stock: number;
  description?: string;
  image?: string;
  vendorId: string;
  status?: Product["status"];
}): Promise<CatalogueProduct> {
  const created = await addCatalogueProducts([input]);
  return created[0];
}

export async function addCatalogueProducts(
  inputs: Array<{
    name: string;
    category: string;
    priceMajor: number;
    stock: number;
    description?: string;
    image?: string;
    vendorId: string;
    status?: Product["status"];
  }>,
): Promise<CatalogueProduct[]> {
  const sb = getServiceSupabase();
  const out: CatalogueProduct[] = [];

  for (const input of inputs) {
    const { data: vendor } = await sb
      .from("vendors")
      .select("id, public_id, name, neighbourhood")
      .eq("public_id", input.vendorId)
      .maybeSingle();
    if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);

    const { data: category } = await sb
      .from("categories")
      .select("id, name")
      .ilike("name", input.category)
      .maybeSingle();

    const { data: store } = await sb
      .from("stores")
      .select("id")
      .eq("vendor_id", vendor.id)
      .eq("is_primary", true)
      .maybeSingle();

    const productPublicId = `prd_${slugify(input.name)}_${Date.now().toString(36)}`;
    const { data: product, error: pErr } = await sb
      .from("products")
      .insert({
        public_id: productPublicId,
        vendor_id: null,
        category_id: category?.id || null,
        name: input.name,
        slug: slugify(input.name),
        description: input.description || "",
        long_description: input.description || "",
        status: input.status || "published",
        image_url: input.image || null,
        images: input.image ? [input.image] : [],
      })
      .select("id, public_id, created_at, updated_at")
      .single();
    if (pErr) throw pErr;

    const offerPublicId = `off_${productPublicId}_${input.vendorId}`;
    const moneyMinor = Math.round(input.priceMajor * 100);
    const { data: offer, error: oErr } = await sb
      .from("product_offers")
      .insert({
        public_id: offerPublicId,
        product_id: product.id,
        vendor_id: vendor.id,
        store_id: store?.id || null,
        price_minor: moneyMinor,
        currency_code: "KES",
        on_hand: input.stock,
        reserved: 0,
        status: "published",
      })
      .select("*")
      .single();
    if (oErr) throw oErr;

    out.push({
      id: offer.public_id,
      name: input.name,
      description: input.description || "",
      longDescription: input.description || "",
      image: input.image || "",
      images: input.image ? [input.image] : [],
      category: category?.name || input.category,
      status: "published",
      vendorId: vendor.public_id,
      vendorName: vendor.name,
      neighbourhood: vendor.neighbourhood || undefined,
      price: input.priceMajor,
      moneyMinor,
      onHand: input.stock,
      reserved: 0,
      stock: input.stock,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    });
  }

  return out;
}
