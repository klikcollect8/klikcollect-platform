import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { productSlugify } from "@/lib/catalogue/slug";
import { generateSku, generateVariantSku } from "@/lib/catalogue/sku";
import { sanitizeProductHtml } from "@/lib/catalogue/sanitize-html";
import { writeProductAudit } from "@/lib/catalogue/audit";
import type { CatalogueDraft } from "@/lib/catalogue/product-draft";
import { evaluateCompleteness } from "@/lib/catalogue/completeness";
import { generateVariantCombos } from "@/lib/catalogue/variants";

export type AdminListFilters = {
  q?: string;
  status?: string;
  kind?: string;
  categoryId?: string;
  brandId?: string;
  missingImage?: boolean;
  missingBarcode?: boolean;
  missingSeo?: boolean;
  hasVariants?: boolean;
  noOffers?: boolean;
  hasOffers?: boolean;
  featured?: boolean;
  guideMinMinor?: number;
  guideMaxMinor?: number;
  sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "guide_asc";
  page?: number;
  pageSize?: number;
};

function mapProductRow(
  row: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: row.public_id,
    uuid: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    longDescription: row.long_description,
    status: row.status,
    image: row.image_url,
    images: (row.images as string[]) || [],
    sku: row.sku,
    barcode: row.barcode,
    gtin: row.gtin,
    manufacturer: row.manufacturer,
    mpn: row.mpn,
    brandId: row.brand_id,
    categoryId: row.category_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    attributes: (row.attributes as Record<string, string>) || {},
    specs: (row.specs as unknown[]) || [],
    perishability: row.perishability,
    weightG: row.weight_g,
    dims: (row.dims as Record<string, unknown>) || {},
    optionAxes: (row.option_axes as unknown[]) || [],
    productKind: row.product_kind || "branded",
    saleUnit: row.sale_unit || null,
    guidePriceMinMinor: row.guide_price_min_minor ?? null,
    guidePriceAvgMinor: row.guide_price_avg_minor ?? null,
    guidePriceMaxMinor: row.guide_price_max_minor ?? null,
    version: row.version || 1,
    featured: row.featured,
    searchVisible: row.search_visible,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extras,
  };
}

export async function listAdminProducts(filters: AdminListFilters = {}) {
  const sb = getServiceSupabase();
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 48));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sort = filters.sort || "updated_desc";
  let q = sb
    .from("products")
    .select(
      "id, public_id, name, slug, description, status, image_url, images, sku, barcode, gtin, brand_id, category_id, seo_title, seo_description, version, updated_at, created_at, featured, product_kind, sale_unit, guide_price_min_minor, guide_price_avg_minor, guide_price_max_minor",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (sort === "name_asc") q = q.order("name", { ascending: true });
  else if (sort === "name_desc") q = q.order("name", { ascending: false });
  else if (sort === "guide_asc")
    q = q.order("guide_price_avg_minor", { ascending: true, nullsFirst: false });
  else if (sort === "updated_asc") q = q.order("updated_at", { ascending: true });
  else q = q.order("updated_at", { ascending: false });

  q = q.range(from, to);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.kind) q = q.eq("product_kind", filters.kind);
  if (filters.categoryId) {
    const { data: cat } = await sb
      .from("categories")
      .select("id")
      .or(`id.eq.${filters.categoryId},public_id.eq.${filters.categoryId}`)
      .maybeSingle();
    if (cat?.id) q = q.eq("category_id", cat.id);
  }
  if (filters.brandId) {
    const { data: brand } = await sb
      .from("brands")
      .select("id")
      .or(`id.eq.${filters.brandId},public_id.eq.${filters.brandId}`)
      .maybeSingle();
    if (brand?.id) q = q.eq("brand_id", brand.id);
  }
  if (filters.featured) q = q.eq("featured", true);
  if (filters.q?.trim()) {
    const term = filters.q.trim();
    q = q.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%,gtin.ilike.%${term}%`,
    );
  }
  if (filters.missingImage) q = q.or("image_url.is.null,image_url.eq.");
  if (filters.missingBarcode) q = q.is("barcode", null);
  if (filters.missingSeo) q = q.or("seo_title.is.null,seo_description.is.null");
  if (typeof filters.guideMinMinor === "number") {
    q = q.gte("guide_price_avg_minor", filters.guideMinMinor);
  }
  if (typeof filters.guideMaxMinor === "number") {
    q = q.lte("guide_price_avg_minor", filters.guideMaxMinor);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const publicIds = (data || []).map((r) => r.public_id as string);
  const offerStats = new Map<
    string,
    { offerCount: number; minPrice: number | null; totalStock: number }
  >();

  if (publicIds.length) {
    const { data: productsUuid } = await sb
      .from("products")
      .select("id, public_id")
      .in("public_id", publicIds);
    const uuidByPublic = new Map(
      (productsUuid || []).map((p) => [p.id as string, p.public_id as string]),
    );
    const uuids = [...uuidByPublic.keys()];
    if (uuids.length) {
      const { data: offers } = await sb
        .from("product_offers")
        .select("product_id, price_minor, on_hand, reserved, status")
        .in("product_id", uuids)
        .is("deleted_at", null);
      for (const o of offers || []) {
        const pid = uuidByPublic.get(o.product_id as string);
        if (!pid) continue;
        const cur = offerStats.get(pid) || {
          offerCount: 0,
          minPrice: null as number | null,
          totalStock: 0,
        };
        cur.offerCount += 1;
        const price = Number(o.price_minor || 0);
        if (cur.minPrice === null || price < cur.minPrice) cur.minPrice = price;
        cur.totalStock += Math.max(
          0,
          Number(o.on_hand || 0) - Number(o.reserved || 0),
        );
        offerStats.set(pid, cur);
      }
    }
  }

  let items = (data || []).map((row) => {
    const stats = offerStats.get(row.public_id as string) || {
      offerCount: 0,
      minPrice: null,
      totalStock: 0,
    };
    return mapProductRow(row as Record<string, unknown>, {
      offerCount: stats.offerCount,
      minPriceMinor: stats.minPrice,
      totalStock: stats.totalStock,
      category: "",
    });
  });

  if (filters.noOffers) {
    items = items.filter((i) => Number(i.offerCount || 0) === 0);
  }
  if (filters.hasOffers) {
    items = items.filter((i) => Number(i.offerCount || 0) > 0);
  }
  if (filters.hasVariants) {
    const { data: vars } = await sb
      .from("product_variants")
      .select("product_public_id")
      .in(
        "product_public_id",
        items.map((i) => i.id),
      )
      .is("deleted_at", null);
    const withVars = new Set((vars || []).map((v) => v.product_public_id));
    items = items.filter((i) => withVars.has(i.id));
  }

  return {
    items,
    total: count || items.length,
    page,
    pageSize,
  };
}

export async function getAdminProductDetail(publicId: string) {
  const sb = getServiceSupabase();
  const { data: product, error } = await sb
    .from("products")
    .select("*, brands(public_id, name, slug), categories(public_id, name)")
    .eq("public_id", publicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return null;

  const [{ data: media }, { data: variants }, { data: offers }, { data: audit }] =
    await Promise.all([
      sb
        .from("product_media")
        .select("*")
        .eq("product_public_id", publicId)
        .is("deleted_at", null)
        .order("sort_order"),
      sb
        .from("product_variants")
        .select("*")
        .eq("product_public_id", publicId)
        .is("deleted_at", null)
        .order("sort_order"),
      sb
        .from("product_offers")
        .select("*, vendors(public_id, name)")
        .eq("product_id", product.id)
        .is("deleted_at", null),
      sb
        .from("product_audit_log")
        .select("*")
        .eq("product_public_id", publicId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const brand = product.brands as { public_id?: string; name?: string } | null;
  const category = product.categories as {
    public_id?: string;
    name?: string;
  } | null;

  return {
    ...mapProductRow(product as Record<string, unknown>, {
      brandName: brand?.name || null,
      brandPublicId: brand?.public_id || null,
      categoryName: category?.name || null,
      categoryPublicId: category?.public_id || null,
    }),
    media: (media || []).map((m) => ({
      id: m.public_id,
      url: m.url,
      role: m.role,
      sortOrder: m.sort_order,
      variantPublicId: m.variant_public_id,
    })),
    variants: (variants || []).map((v) => ({
      id: v.public_id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      options: v.options || {},
      status: v.status,
      sortOrder: v.sort_order,
    })),
    offers: (offers || []).map((o) => {
      const vendor = o.vendors as { public_id?: string; name?: string } | null;
      return {
        id: o.public_id,
        vendorId: vendor?.public_id || null,
        vendorName: vendor?.name || null,
        priceMinor: o.price_minor,
        onHand: o.on_hand,
        reserved: o.reserved,
        stock: Math.max(0, Number(o.on_hand || 0) - Number(o.reserved || 0)),
        status: o.status,
        variantPublicId: o.variant_public_id,
        barcode: o.barcode,
        gtin: o.gtin,
      };
    }),
    audit: (audit || []).map((a) => ({
      id: a.id,
      action: a.action,
      actorEmail: a.actor_email,
      reason: a.reason,
      createdAt: a.created_at,
      before: a.before_state,
      after: a.after_state,
    })),
  };
}

async function resolveBrandId(
  brandId?: string | null,
  brandName?: string | null,
): Promise<string | null> {
  const sb = getServiceSupabase();
  if (brandId) {
    const { data } = await sb
      .from("brands")
      .select("id")
      .or(`id.eq.${brandId},public_id.eq.${brandId}`)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (!brandName?.trim()) return null;
  const name = brandName.trim();
  const slug = productSlugify(name);
  const { data: existing } = await sb
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await sb
    .from("brands")
    .insert({
      public_id: publicId("brd"),
      name,
      slug,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

async function resolveCategoryUuid(categoryId?: string | null) {
  if (!categoryId) return null;
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("categories")
    .select("id, name")
    .or(`id.eq.${categoryId},public_id.eq.${categoryId}`)
    .maybeSingle();
  return data;
}

export async function upsertDraftProduct(
  draft: CatalogueDraft,
  actor: { userId: string; email?: string | null },
) {
  const sb = getServiceSupabase();
  const brandUuid = await resolveBrandId(draft.brandId, draft.brandName);
  const category = await resolveCategoryUuid(draft.categoryId);
  const sku = draft.sku?.trim() || generateSku(draft.name || "product");
  const slug =
    draft.slug?.trim() ||
    productSlugify(draft.name || sku || `product-${Date.now()}`);
  const longHtml = sanitizeProductHtml(draft.longDescription || "");

  const payload = {
    name: (draft.name || "Untitled product").trim(),
    slug,
    description: (draft.description || "").trim() || "—",
    long_description: longHtml || null,
    status: draft.status || "draft",
    sku,
    barcode: draft.barcode || null,
    gtin: draft.gtin || draft.barcode || null,
    manufacturer: draft.manufacturer || null,
    mpn: draft.mpn || null,
    brand_id: brandUuid,
    category_id: category?.id || null,
    seo_title: draft.seoTitle || draft.name || null,
    seo_description: draft.seoDescription || draft.description || null,
    attributes: draft.attributes || {},
    specs: draft.specs || [],
    perishability: draft.perishability || null,
    weight_g: draft.weightG ?? null,
    dims: draft.dims || {},
    option_axes: draft.optionAxes || [],
    product_kind: draft.productKind || "branded",
    sale_unit: draft.saleUnit || null,
    guide_price_min_minor:
      draft.guidePriceMinMinor != null
        ? Math.round(Number(draft.guidePriceMinMinor))
        : null,
    guide_price_avg_minor:
      draft.guidePriceAvgMinor != null
        ? Math.round(Number(draft.guidePriceAvgMinor))
        : null,
    guide_price_max_minor:
      draft.guidePriceMaxMinor != null
        ? Math.round(Number(draft.guidePriceMaxMinor))
        : null,
    image_url: draft.imageUrl || draft.media?.find((m) => m.role === "main")?.url || null,
    images: draft.images || draft.media?.map((m) => m.url) || [],
    featured: Boolean(draft.featured),
    search_visible: draft.searchVisible !== false,
    updated_at: new Date().toISOString(),
  };

  let publicIdValue = draft.publicId;
  let before: Record<string, unknown> | null = null;

  if (publicIdValue) {
    const { data: existing } = await sb
      .from("products")
      .select("*")
      .eq("public_id", publicIdValue)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) throw new Error("Product not found");
    if (
      typeof draft.version === "number" &&
      Number(existing.version || 1) !== draft.version
    ) {
      const err = new Error(
        "This product was changed by another administrator while you were editing it.",
      ) as Error & { status: number };
      err.status = 409;
      throw err;
    }
    before = existing as Record<string, unknown>;
    const { data, error } = await sb
      .from("products")
      .update({
        ...payload,
        version: Number(existing.version || 1) + 1,
      })
      .eq("public_id", publicIdValue)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await writeProductAudit({
      productPublicId: publicIdValue,
      actorClerkUserId: actor.userId,
      actorEmail: actor.email,
      action: "draft.saved",
      before,
      after: data,
    });
    return mapProductRow(data as Record<string, unknown>);
  }

  publicIdValue = publicId("prd");
  const { data, error } = await sb
    .from("products")
    .insert({
      public_id: publicIdValue,
      ...payload,
      // Allow resolver imports to land as pending_review; wizard defaults to draft.
      status: payload.status || "draft",
      version: 1,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await writeProductAudit({
    productPublicId: publicIdValue,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "draft.created",
    after: data,
  });

  return mapProductRow(data as Record<string, unknown>);
}

export async function replaceVariants(
  productPublicId: string,
  draft: CatalogueDraft,
  actor: { userId: string; email?: string | null },
) {
  const sb = getServiceSupabase();
  const { data: product } = await sb
    .from("products")
    .select("id, public_id, sku, option_axes")
    .eq("public_id", productPublicId)
    .maybeSingle();
  if (!product) throw new Error("Product not found");

  const axes = draft.optionAxes || [];
  let variants = draft.variants || [];
  if (!variants.length && axes.length) {
    const combos = generateVariantCombos(axes);
    variants = combos.map((c) => ({
      title: c.title,
      options: c.options,
      sku: generateVariantSku(String(product.sku || "SKU"), c.options),
      status: "active" as const,
    }));
  }
  if (!variants.length) {
    variants = [
      {
        title: "Default",
        options: {},
        sku: String(product.sku || generateSku(productPublicId)),
        status: "active",
      },
    ];
  }

  await sb
    .from("product_variants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("product_public_id", productPublicId)
    .is("deleted_at", null);

  const rows = variants.map((v, idx) => ({
    public_id: v.publicId || publicId("var"),
    product_id: product.id,
    product_public_id: productPublicId,
    vendor_id: null,
    title: v.title,
    options: v.options || {},
    sku: v.sku || generateVariantSku(String(product.sku || "SKU"), v.options || {}),
    barcode: v.barcode || null,
    status: v.status || "active",
    sort_order: idx,
    price_minor: 0,
    currency_code: "KES",
    on_hand: 0,
    reserved: 0,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await sb.from("product_variants").insert(rows).select("*");
  if (error) throw new Error(error.message);

  await sb
    .from("products")
    .update({ option_axes: axes, updated_at: new Date().toISOString() })
    .eq("public_id", productPublicId);

  await writeProductAudit({
    productPublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "variants.replaced",
    after: { count: rows.length },
  });

  return data;
}

export async function upsertProductMedia(
  productPublicId: string,
  media: CatalogueDraft["media"],
  actor: { userId: string; email?: string | null },
) {
  const sb = getServiceSupabase();
  const { data: product } = await sb
    .from("products")
    .select("id")
    .eq("public_id", productPublicId)
    .maybeSingle();
  if (!product) throw new Error("Product not found");

  const list = media || [];
  await sb
    .from("product_media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("product_public_id", productPublicId)
    .is("deleted_at", null);

  if (list.length) {
    const rows = list.map((m, idx) => ({
      public_id: m.publicId || publicId("med"),
      product_id: product.id,
      product_public_id: productPublicId,
      role: m.role || (idx === 0 ? "main" : "gallery"),
      url: m.url,
      original_url: m.url,
      sort_order: m.sortOrder ?? idx,
    }));
    const { error } = await sb.from("product_media").insert(rows);
    if (error) throw new Error(error.message);
  }

  const main = list.find((m) => m.role === "main") || list[0];
  await sb
    .from("products")
    .update({
      image_url: main?.url || null,
      images: list.map((m) => m.url),
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", productPublicId);

  await writeProductAudit({
    productPublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "media.updated",
    after: { count: list.length },
  });
}

export async function upsertSeedOffer(
  productPublicId: string,
  offer: NonNullable<CatalogueDraft["offer"]>,
  actor: { userId: string; email?: string | null },
) {
  if (!offer.vendorPublicId) throw new Error("Vendor is required for an offer.");
  const priceMinor = Math.round(Number(offer.priceMinor || 0));
  if (priceMinor <= 0) throw new Error("Offer price must be greater than zero.");

  const sb = getServiceSupabase();
  const { data: product } = await sb
    .from("products")
    .select("id, public_id")
    .eq("public_id", productPublicId)
    .maybeSingle();
  if (!product) throw new Error("Product not found");

  const { data: vendor } = await sb
    .from("vendors")
    .select("id, public_id")
    .eq("public_id", offer.vendorPublicId)
    .maybeSingle();
  if (!vendor) throw new Error("Vendor not found");

  const onHand = Math.max(0, Math.round(Number(offer.onHand || 0)));
  const variantKey = offer.variantPublicId || null;

  const { data: existing } = await sb
    .from("product_offers")
    .select("*")
    .eq("product_id", product.id)
    .eq("vendor_id", vendor.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Prefer match on variant when provided
  let target = existing;
  if (variantKey) {
    const { data: byVariant } = await sb
      .from("product_offers")
      .select("*")
      .eq("product_id", product.id)
      .eq("vendor_id", vendor.id)
      .eq("variant_public_id", variantKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (byVariant) target = byVariant;
  } else if (existing?.variant_public_id) {
    const { data: def } = await sb
      .from("product_offers")
      .select("*")
      .eq("product_id", product.id)
      .eq("vendor_id", vendor.id)
      .is("variant_public_id", null)
      .is("deleted_at", null)
      .maybeSingle();
    target = def || existing;
  }

  if (target) {
    const prev = Number(target.on_hand || 0);
    const { data, error } = await sb
      .from("product_offers")
      .update({
        price_minor: priceMinor,
        on_hand: onHand,
        status: offer.status || "draft",
        variant_public_id: variantKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (prev !== onHand) {
      await sb.from("inventory_movements").insert({
        offer_public_id: data.public_id,
        product_public_id: productPublicId,
        vendor_public_id: vendor.public_id,
        variant_public_id: variantKey,
        kind: "adjust",
        quantity: onHand - prev,
        meta: {
          reason: "admin_seed_offer",
          previousQuantity: prev,
          newQuantity: onHand,
          actorUserId: actor.userId,
        },
      });
    }
    await writeProductAudit({
      productPublicId,
      actorClerkUserId: actor.userId,
      actorEmail: actor.email,
      action: "offer.updated",
      after: data,
    });
    return data;
  }

  const offerPublicId = publicId("off");
  const { data, error } = await sb
    .from("product_offers")
    .insert({
      public_id: offerPublicId,
      product_id: product.id,
      vendor_id: vendor.id,
      price_minor: priceMinor,
      currency_code: "KES",
      on_hand: onHand,
      reserved: 0,
      status: offer.status || "draft",
      variant_public_id: variantKey,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await sb.from("inventory_movements").insert({
    offer_public_id: offerPublicId,
    product_public_id: productPublicId,
    vendor_public_id: vendor.public_id,
    variant_public_id: variantKey,
    kind: "adjust",
    quantity: onHand,
    meta: {
      reason: "initial_stock",
      previousQuantity: 0,
      newQuantity: onHand,
      actorUserId: actor.userId,
    },
  });

  await writeProductAudit({
    productPublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "offer.created",
    after: data,
  });
  return data;
}

export async function publishProduct(
  productPublicId: string,
  opts: {
    actor: { userId: string; email?: string | null };
    override?: boolean;
    reason?: string;
    asReview?: boolean;
  },
) {
  const detail = await getAdminProductDetail(productPublicId);
  if (!detail) throw new Error("Product not found");
  const row = detail as Record<string, unknown> & typeof detail;

  const draft: CatalogueDraft = {
    publicId: String(row.id),
    name: String(row.name || ""),
    sku: row.sku ? String(row.sku) : undefined,
    barcode: row.barcode ? String(row.barcode) : undefined,
    gtin: row.gtin ? String(row.gtin) : undefined,
    categoryId: row.categoryId ? String(row.categoryId) : undefined,
    description: row.description ? String(row.description) : undefined,
    longDescription: row.longDescription
      ? String(row.longDescription)
      : undefined,
    imageUrl: row.image ? String(row.image) : undefined,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    media: detail.media,
    slug: row.slug ? String(row.slug) : undefined,
    seoTitle: row.seoTitle ? String(row.seoTitle) : undefined,
    seoDescription: row.seoDescription
      ? String(row.seoDescription)
      : undefined,
    brandName: row.brandName ? String(row.brandName) : undefined,
    variants: detail.variants,
    optionAxes: Array.isArray(row.optionAxes)
      ? (row.optionAxes as CatalogueDraft["optionAxes"])
      : [],
    productKind: (row.productKind as CatalogueDraft["productKind"]) || "branded",
    saleUnit: (row.saleUnit as CatalogueDraft["saleUnit"]) || null,
    guidePriceMinMinor:
      row.guidePriceMinMinor != null ? Number(row.guidePriceMinMinor) : null,
    guidePriceAvgMinor:
      row.guidePriceAvgMinor != null ? Number(row.guidePriceAvgMinor) : null,
    guidePriceMaxMinor:
      row.guidePriceMaxMinor != null ? Number(row.guidePriceMaxMinor) : null,
    offer: undefined,
  };

  const completeness = evaluateCompleteness(draft);
  if (!completeness.canPublish && !opts.override) {
    const err = new Error(
      `Cannot publish: ${completeness.blockers.join(" · ") || "incomplete product"}`,
    ) as Error & { status: number; completeness: typeof completeness };
    err.status = 400;
    err.completeness = completeness;
    throw err;
  }
  if (opts.override && !opts.reason?.trim()) {
    throw new Error("Override reason is required to publish an incomplete product.");
  }

  const sb = getServiceSupabase();
  const nextStatus = opts.asReview ? "pending_review" : "published";
  const { data, error } = await sb
    .from("products")
    .update({
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
      archived_at: null,
      version: Number(row.version || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", productPublicId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Publish draft offers when product publishes
  if (nextStatus === "published") {
    await sb
      .from("product_offers")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("product_id", row.uuid)
      .eq("status", "draft")
      .is("deleted_at", null);
  }

  await writeProductAudit({
    productPublicId,
    actorClerkUserId: opts.actor.userId,
    actorEmail: opts.actor.email,
    action: opts.asReview ? "submitted_review" : "published",
    after: data,
    reason: opts.reason || null,
  });

  return { product: mapProductRow(data as Record<string, unknown>), completeness };
}

export async function archiveProduct(
  productPublicId: string,
  actor: { userId: string; email?: string | null },
  reason?: string,
) {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("products")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", productPublicId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await writeProductAudit({
    productPublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "archived",
    after: data,
    reason: reason || null,
  });
  return mapProductRow(data as Record<string, unknown>);
}

export async function duplicateProduct(
  productPublicId: string,
  actor: { userId: string; email?: string | null },
) {
  const detail = await getAdminProductDetail(productPublicId);
  if (!detail) throw new Error("Product not found");
  const row = detail as Record<string, unknown> & typeof detail;
  const created = await upsertDraftProduct(
    {
      name: `${String(row.name)} (copy)`,
      description: row.description ? String(row.description) : undefined,
      longDescription: row.longDescription
        ? String(row.longDescription)
        : undefined,
      brandId: row.brandId ? String(row.brandId) : undefined,
      brandName: row.brandName ? String(row.brandName) : undefined,
      categoryId: row.categoryId ? String(row.categoryId) : undefined,
      manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
      mpn: row.mpn ? String(row.mpn) : undefined,
      attributes: (row.attributes as Record<string, string>) || {},
      specs: (row.specs as CatalogueDraft["specs"]) || [],
      perishability: row.perishability ? String(row.perishability) : undefined,
      weightG: typeof row.weightG === "number" ? row.weightG : undefined,
      dims: (row.dims as CatalogueDraft["dims"]) || {},
      imageUrl: row.image ? String(row.image) : undefined,
      images: Array.isArray(row.images) ? (row.images as string[]) : [],
      media: detail.media,
      optionAxes: Array.isArray(row.optionAxes)
        ? (row.optionAxes as CatalogueDraft["optionAxes"])
        : [],
      seoTitle: row.seoTitle ? String(row.seoTitle) : undefined,
      seoDescription: row.seoDescription
        ? String(row.seoDescription)
        : undefined,
      status: "draft",
    },
    actor,
  );
  if (detail.media?.length) {
    await upsertProductMedia(String(created.id), detail.media, actor);
  }
  if (detail.variants?.length || (row.optionAxes as unknown[])?.length) {
    await replaceVariants(
      String(created.id),
      {
        name: String(created.name),
        optionAxes: Array.isArray(row.optionAxes)
          ? (row.optionAxes as CatalogueDraft["optionAxes"])
          : [],
        variants: (detail.variants || []).map((v) => ({
          title: v.title,
          options: v.options,
          sku: v.sku,
          barcode: v.barcode,
          status: "active" as const,
        })),
      },
      actor,
    );
  }
  return created;
}

export async function listBrands(q?: string) {
  const sb = getServiceSupabase();
  let query = sb
    .from("brands")
    .select("public_id, name, slug, status")
    .eq("status", "active")
    .order("name")
    .limit(50);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listCategoryTree() {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("categories")
    .select("id, public_id, name, parent_id, slug")
    .order("name");
  if (error) throw new Error(error.message);
  return data || [];
}
