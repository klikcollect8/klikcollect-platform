import type { BarcodeFormat } from "@/lib/catalogue/barcode-normalize";

export type ProviderId =
  | "klikcollect"
  | "open_food_facts"
  | "open_products_facts";

export type FieldConfidence = "high" | "medium" | "low" | "unknown";

export type ProvenanceStatus = "imported" | "needs_review" | "missing" | "local";

export type CandidateField<T = string> = {
  value: T | null;
  provider: ProviderId | "manual" | null;
  externalProductId?: string | null;
  confidence: FieldConfidence;
  status: ProvenanceStatus;
  originalValue?: unknown;
};

export type CandidateImage = {
  url: string;
  role: "front" | "ingredients" | "nutrition" | "packaging" | "gallery";
  provider: ProviderId;
  sourceUrl: string;
};

export type CandidateProduct = {
  barcode: string;
  format: BarcodeFormat;
  name: CandidateField;
  brand: CandidateField;
  genericName: CandidateField;
  quantity: CandidateField;
  unit: CandidateField;
  description: CandidateField;
  ingredients: CandidateField;
  allergens: CandidateField;
  additives: CandidateField;
  traces: CandidateField;
  nutrition: CandidateField<Record<string, unknown> | null>;
  nutriscore: CandidateField;
  labels: CandidateField<string[]>;
  externalCategories: CandidateField<string[]>;
  countries: CandidateField<string[]>;
  packaging: CandidateField;
  images: CandidateImage[];
  manufacturer: CandidateField;
  servingSize: CandidateField;
  /** Provider product IDs that contributed */
  sources: Array<{
    provider: ProviderId;
    externalProductId: string | null;
    sourceUrl: string | null;
    fetchedAt: string;
  }>;
};

export type LocalProductHit = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  gtin: string | null;
  status: string;
  image: string | null;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  updatedAt: string | null;
};

export type ProviderLookupStatus =
  | "hit"
  | "miss"
  | "error"
  | "timeout"
  | "rate_limited"
  | "skipped";

export type ProviderLookupResult = {
  provider: ProviderId;
  status: ProviderLookupStatus;
  message?: string;
  candidate?: Partial<CandidateProduct> | null;
  externalProductId?: string | null;
  sourceUrl?: string | null;
  fetchedAt: string;
  fromCache?: boolean;
};

export type ResolutionStatus =
  | "local_found"
  | "external_found"
  | "partial"
  | "not_found"
  | "invalid"
  | "error";

export type ResolveResult = {
  barcode: string;
  format: BarcodeFormat;
  valid: boolean;
  resolutionStatus: ResolutionStatus;
  localProduct: LocalProductHit | null;
  candidate: CandidateProduct | null;
  providerResults: ProviderLookupResult[];
  message: string;
  scanEventId?: string | null;
};

export type ResolveCommitInput = {
  barcode: string;
  format?: BarcodeFormat;
  name: string;
  brand?: string | null;
  brandId?: string | null;
  description?: string | null;
  categoryId: string;
  quantity?: string | null;
  unit?: string | null;
  manufacturer?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  images?: string[];
  externalCategories?: string[];
  attributes?: Record<string, string>;
  productKind?: "branded" | "packaged_grocery" | "fresh_weight" | "variable_bulk";
  sources?: Array<{
    provider: ProviderId;
    externalProductId?: string | null;
    sourceUrl?: string | null;
  }>;
  fieldProvenance?: Array<{
    fieldKey: string;
    provider: ProviderId | "manual";
    externalProductId?: string | null;
    originalValue?: unknown;
    normalisedValue?: unknown;
    confidence?: FieldConfidence;
    adminOverride?: boolean;
  }>;
  /** Keep as pending_review (default) */
  status?: "draft" | "pending_review";
};
