import { getServiceSupabase } from "@/lib/supabase/admin";
import type { ProductDataProvider } from "@/lib/product-resolver/interface";
import { emptyField, fieldFromProvider } from "@/lib/product-resolver/field";
import type {
  CandidateProduct,
  LocalProductHit,
  ProviderLookupResult,
} from "@/lib/product-resolver/types";

export async function findLocalProductByBarcode(
  barcode: string,
): Promise<LocalProductHit | null> {
  const sb = getServiceSupabase();
  const { data: product } = await sb
    .from("products")
    .select(
      "public_id, name, sku, barcode, gtin, status, image_url, brand_id, category_id, updated_at",
    )
    .or(`barcode.eq.${barcode},gtin.eq.${barcode}`)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();

  if (product) {
    let brand: string | null = null;
    let categoryName: string | null = null;
    if (product.brand_id) {
      const { data: b } = await sb
        .from("brands")
        .select("name")
        .eq("id", product.brand_id)
        .maybeSingle();
      brand = b?.name || null;
    }
    if (product.category_id) {
      const { data: c } = await sb
        .from("categories")
        .select("name")
        .eq("id", product.category_id)
        .maybeSingle();
      categoryName = c?.name || null;
    }
    return {
      id: product.public_id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      gtin: product.gtin,
      status: product.status,
      image: product.image_url,
      brand,
      categoryId: product.category_id,
      categoryName,
      updatedAt: product.updated_at,
    };
  }

  const { data: variant } = await sb
    .from("product_variants")
    .select("public_id, title, product_public_id, barcode, sku")
    .eq("barcode", barcode)
    .is("deleted_at", null)
    .maybeSingle();

  if (variant?.product_public_id) {
    const { data: parent } = await sb
      .from("products")
      .select(
        "public_id, name, sku, barcode, gtin, status, image_url, brand_id, category_id, updated_at",
      )
      .eq("public_id", variant.product_public_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (parent) {
      return {
        id: parent.public_id,
        name: parent.name,
        sku: parent.sku,
        barcode: variant.barcode || parent.barcode,
        gtin: parent.gtin,
        status: parent.status,
        image: parent.image_url,
        brand: null,
        categoryId: parent.category_id,
        categoryName: null,
        updatedAt: parent.updated_at,
      };
    }
  }

  // Previously linked external source
  const { data: linked } = await sb
    .from("product_external_sources")
    .select("product_public_id")
    .eq("barcode", barcode)
    .limit(1)
    .maybeSingle();
  if (linked?.product_public_id) {
    return findLocalProductByPublicId(linked.product_public_id);
  }

  return null;
}

async function findLocalProductByPublicId(
  publicId: string,
): Promise<LocalProductHit | null> {
  const sb = getServiceSupabase();
  const { data: product } = await sb
    .from("products")
    .select(
      "public_id, name, sku, barcode, gtin, status, image_url, brand_id, category_id, updated_at",
    )
    .eq("public_id", publicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) return null;
  return {
    id: product.public_id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    gtin: product.gtin,
    status: product.status,
    image: product.image_url,
    brand: null,
    categoryId: product.category_id,
    categoryName: null,
    updatedAt: product.updated_at,
  };
}

export const klikCollectProvider: ProductDataProvider = {
  getProviderName: () => "klikcollect",
  getSupportedProductTypes: () => ["any"],
  normaliseResponse(raw) {
    return (raw as Partial<CandidateProduct>) || null;
  },
  async getProductByBarcode(barcode: string): Promise<ProviderLookupResult> {
    const fetchedAt = new Date().toISOString();
    try {
      const hit = await findLocalProductByBarcode(barcode);
      if (!hit) {
        return {
          provider: "klikcollect",
          status: "miss",
          message: "No existing product found for this barcode.",
          fetchedAt,
        };
      }
      const candidate: Partial<CandidateProduct> = {
        barcode,
        name: fieldFromProvider(hit.name, "klikcollect", { confidence: "high" }),
        brand: fieldFromProvider(hit.brand, "klikcollect", { confidence: "high" }),
        genericName: emptyField(),
        quantity: emptyField(),
        unit: emptyField(),
        description: emptyField(),
        ingredients: emptyField(),
        allergens: emptyField(),
        additives: emptyField(),
        traces: emptyField(),
        nutrition: emptyField(),
        nutriscore: emptyField(),
        novaGroup: emptyField(),
        ecoscore: emptyField(),
        labels: emptyField(),
        externalCategories: emptyField(),
        countries: emptyField(),
        stores: emptyField(),
        origins: emptyField(),
        packaging: emptyField(),
        manufacturer: emptyField(),
        servingSize: emptyField(),
        storage: emptyField(),
        vegan: emptyField(),
        vegetarian: emptyField(),
        palmOil: emptyField(),
        pnnsGroup: emptyField(),
        foodGroup: emptyField(),
        nutrientLevels: emptyField(),
        embCodes: emptyField(),
        producerLink: emptyField(),
        brandsAll: emptyField(),
        completeness: emptyField(),
        extraAttributes: {},
        specs: [],
        similarQuery: {},
        images: hit.image
          ? [
              {
                url: hit.image,
                role: "front",
                provider: "klikcollect",
                sourceUrl: hit.image,
              },
            ]
          : [],
        sources: [
          {
            provider: "klikcollect",
            externalProductId: hit.id,
            sourceUrl: `/admin/products/${hit.id}`,
            fetchedAt,
          },
        ],
      };
      return {
        provider: "klikcollect",
        status: "hit",
        candidate,
        externalProductId: hit.id,
        sourceUrl: `/admin/products/${hit.id}`,
        fetchedAt,
      };
    } catch (err) {
      console.error("[klikcollect_provider]", err);
      return {
        provider: "klikcollect",
        status: "error",
        message: "Could not search KlikCollect catalogue.",
        fetchedAt,
      };
    }
  },
};
