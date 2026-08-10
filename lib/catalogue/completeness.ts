import type { CatalogueDraft, ProductKind } from "@/lib/catalogue/product-draft";
import {
  kindNeedsVariants,
  kindRequiresBrand,
  kindRequiresBarcode,
  warnWeakProductName,
} from "@/lib/catalogue/product-draft";

export type CompletenessItem = {
  id: string;
  label: string;
  group: "identity" | "media" | "commerce" | "seo" | "compliance";
  required: boolean;
  ok: boolean;
  hint?: string;
};

export type CompletenessResult = {
  score: number;
  items: CompletenessItem[];
  canPublish: boolean;
  blockers: string[];
  recommendations: string[];
};

function hasGuideBand(draft: CatalogueDraft): boolean {
  const min = Number(draft.guidePriceMinMinor);
  const avg = Number(draft.guidePriceAvgMinor);
  const max = Number(draft.guidePriceMaxMinor);
  if (![min, avg, max].every((n) => Number.isFinite(n) && n > 0)) return false;
  return min <= avg && avg <= max;
}

export function evaluateCompleteness(draft: CatalogueDraft): CompletenessResult {
  const kind = (draft.productKind || "branded") as ProductKind;
  const nameWarn = warnWeakProductName(draft.name || "");
  const hasMainImage = Boolean(
    draft.imageUrl ||
      draft.media?.some((m) => m.role === "main" && m.url) ||
      (draft.images && draft.images[0]),
  );
  const hasCategory = Boolean(draft.categoryId);
  const hasSku = Boolean(draft.sku?.trim());
  const hasDesc = Boolean((draft.description || "").trim().length >= 8);
  const hasSlug = Boolean(draft.slug?.trim());
  const hasSeoTitle = Boolean(draft.seoTitle?.trim());
  const hasSeoDesc = Boolean(draft.seoDescription?.trim());
  const hasKind = Boolean(draft.productKind);
  const hasBrand = Boolean(draft.brandId || draft.brandName);
  const hasBarcode = Boolean(draft.barcode || draft.gtin);
  const guideOk = hasGuideBand(draft);
  const needsVariants = kindNeedsVariants(kind);
  const hasVariants =
    !needsVariants ||
    (draft.variants && draft.variants.length > 0) ||
    !(draft.optionAxes && draft.optionAxes.length);
  const saleUnitOk =
    kind === "fresh_weight" || kind === "variable_bulk"
      ? Boolean(draft.saleUnit)
      : true;
  const perishOk =
    kind === "fresh_weight" ? Boolean(draft.perishability) : true;

  const brandRequired = kindRequiresBrand(kind);
  const barcodeRequired = kindRequiresBarcode(kind);

  const items: CompletenessItem[] = [
    {
      id: "kind",
      label: "Product type",
      group: "identity",
      required: true,
      ok: hasKind,
      hint: "Choose how this product is sold.",
    },
    {
      id: "name",
      label: "Product name",
      group: "identity",
      required: true,
      ok: !nameWarn || nameWarn.includes("generic"),
      hint: nameWarn || undefined,
    },
    {
      id: "brand",
      label: "Brand",
      group: "identity",
      required: brandRequired,
      ok: hasBrand,
      hint: brandRequired
        ? "Branded products need a brand."
        : "Add a brand for better filtering.",
    },
    {
      id: "category",
      label: "Category",
      group: "identity",
      required: true,
      ok: hasCategory,
      hint: "Select a category before publishing.",
    },
    {
      id: "sku",
      label: "SKU",
      group: "identity",
      required: true,
      ok: hasSku,
    },
    {
      id: "barcode",
      label: "Barcode",
      group: "identity",
      required: barcodeRequired,
      ok: hasBarcode,
      hint: barcodeRequired
        ? "Branded products need a barcode / GTIN."
        : "Barcode helps physical catalogue scanning.",
    },
    {
      id: "sale_unit",
      label: "Sale unit",
      group: "identity",
      required: kind === "fresh_weight" || kind === "variable_bulk",
      ok: saleUnitOk,
      hint: "Choose kg, g, L, pack, or each.",
    },
    {
      id: "perishability",
      label: "Perishability",
      group: "identity",
      required: kind === "fresh_weight",
      ok: perishOk,
      hint: "Mark how this fresh product should be handled.",
    },
    {
      id: "description",
      label: "Short description",
      group: "identity",
      required: true,
      ok: hasDesc,
    },
    {
      id: "main_image",
      label: "Primary image",
      group: "media",
      required: true,
      ok: hasMainImage,
      hint: "Add a clear primary product image.",
    },
    {
      id: "gallery",
      label: "Gallery image",
      group: "media",
      required: false,
      ok: (draft.media?.length || draft.images?.length || 0) > 1,
      hint: "Add a second product image.",
    },
    {
      id: "variants",
      label: "Variant configuration",
      group: "commerce",
      required: needsVariants,
      ok: hasVariants,
    },
    {
      id: "guide_prices",
      label: "Guide price band",
      group: "commerce",
      required: true,
      ok: guideOk,
      hint: "Set starting, average, and ending guide prices (min ≤ avg ≤ max).",
    },
    {
      id: "slug",
      label: "URL slug",
      group: "seo",
      required: true,
      ok: hasSlug,
    },
    {
      id: "seo_title",
      label: "SEO title",
      group: "seo",
      required: false,
      ok: hasSeoTitle,
    },
    {
      id: "seo_desc",
      label: "Meta description",
      group: "seo",
      required: false,
      ok: hasSeoDesc,
    },
  ];

  if (nameWarn && nameWarn.includes("required")) {
    const nameItem = items.find((i) => i.id === "name");
    if (nameItem) nameItem.ok = false;
  } else if (draft.name?.trim()) {
    const nameItem = items.find((i) => i.id === "name");
    if (nameItem) nameItem.ok = true;
  }

  const required = items.filter((i) => i.required);
  const okRequired = required.filter((i) => i.ok).length;
  const okAll = items.filter((i) => i.ok).length;
  const score = Math.round((okAll / items.length) * 100);
  const blockers = required.filter((i) => !i.ok).map((i) => i.hint || i.label);
  const recommendations = items
    .filter((i) => !i.required && !i.ok)
    .map((i) => i.hint || `Add ${i.label.toLowerCase()}`)
    .slice(0, 5);

  return {
    score,
    items,
    canPublish:
      okRequired === required.length &&
      Boolean(draft.name?.trim()) &&
      hasKind &&
      hasCategory &&
      hasSku &&
      hasDesc &&
      hasMainImage &&
      guideOk &&
      hasSlug,
    blockers,
    recommendations,
  };
}
