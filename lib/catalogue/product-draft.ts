export type SpecRow = { key: string; value: string };

export type ProductKind =
  | "branded"
  | "fresh_weight"
  | "packaged_grocery"
  | "variable_bulk";

export type SaleUnit = "each" | "kg" | "g" | "l" | "pack";

export const PRODUCT_KINDS: Array<{
  id: ProductKind;
  label: string;
  description: string;
}> = [
  {
    id: "branded",
    label: "Branded / manufactured",
    description: "Fixed SKU with brand, barcode, and optional variants.",
  },
  {
    id: "fresh_weight",
    label: "Fresh by weight",
    description: "Produce and perishables sold by kg or g — no barcode required.",
  },
  {
    id: "packaged_grocery",
    label: "Packaged grocery",
    description: "Packaged staples with pack size; barcode preferred.",
  },
  {
    id: "variable_bulk",
    label: "Variable / bulk",
    description: "Sold by measure (kg, L, each) without a fixed barcode.",
  },
];

export type CatalogueDraft = {
  publicId?: string;
  version?: number;
  name: string;
  productKind?: ProductKind;
  saleUnit?: SaleUnit | null;
  brandId?: string | null;
  brandName?: string | null;
  manufacturer?: string | null;
  mpn?: string | null;
  sku?: string | null;
  barcode?: string | null;
  gtin?: string | null;
  categoryId?: string | null;
  categoryPath?: string | null;
  description?: string;
  longDescription?: string;
  attributes?: Record<string, string>;
  specs?: SpecRow[];
  perishability?: string | null;
  weightG?: number | null;
  dims?: { length?: number; width?: number; height?: number; unit?: string };
  imageUrl?: string | null;
  images?: string[];
  media?: Array<{
    publicId?: string;
    url: string;
    role:
      | "main"
      | "gallery"
      | "variant"
      | "ingredients"
      | "nutrition"
      | "packaging";
    sortOrder?: number;
  }>;
  optionAxes?: Array<{ name: string; values: string[] }>;
  variants?: Array<{
    publicId?: string;
    title: string;
    options: Record<string, string>;
    sku?: string;
    barcode?: string;
    status?: "active" | "draft" | "archived";
  }>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  slug?: string | null;
  featured?: boolean;
  searchVisible?: boolean;
  status?: "draft" | "pending_review" | "published" | "archived";
  /** Advisory guide band (KES minor) — not vendor offer price */
  guidePriceMinMinor?: number | null;
  guidePriceAvgMinor?: number | null;
  guidePriceMaxMinor?: number | null;
  /** @deprecated Admin no longer seeds offers on create */
  offer?: {
    vendorPublicId?: string;
    priceMinor?: number;
    onHand?: number;
    status?: "draft" | "published" | "archived";
    variantPublicId?: string | null;
  };
  duplicateAck?: boolean;
};

export const WEAK_PRODUCT_NAMES = new Set([
  "product",
  "product 1",
  "new product",
  "item",
  "test",
  "phone",
  "untitled",
  "sample",
]);

export function warnWeakProductName(name: string): string | null {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "Product name is required.";
  if (n.length < 3) return "Product name looks too short.";
  if (WEAK_PRODUCT_NAMES.has(n)) {
    return "This name is too generic. Prefer a specific marketplace name (brand + product + size).";
  }
  return null;
}

export function kindNeedsVariants(kind?: ProductKind): boolean {
  return kind === "branded" || kind === "packaged_grocery";
}

export function kindRequiresBrand(kind?: ProductKind): boolean {
  return kind === "branded";
}

export function kindRequiresBarcode(kind?: ProductKind): boolean {
  return kind === "branded";
}

export function kindPrefersBarcode(kind?: ProductKind): boolean {
  return kind === "packaged_grocery";
}

export function emptyDraft(): CatalogueDraft {
  return {
    name: "",
    productKind: undefined,
    saleUnit: "each",
    description: "",
    longDescription: "",
    attributes: {},
    specs: [],
    images: [],
    media: [],
    optionAxes: [],
    variants: [],
    status: "draft",
    searchVisible: true,
    featured: false,
    duplicateAck: false,
    guidePriceMinMinor: null,
    guidePriceAvgMinor: null,
    guidePriceMaxMinor: null,
  };
}
