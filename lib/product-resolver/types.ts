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

export type CandidateSpec = {
  key: string;
  value: string;
  provider?: ProviderId | "manual";
};

export type SimilarQueryHints = {
  brand?: string | null;
  categoryTags?: string[];
  searchTerms?: string | null;
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
  novaGroup: CandidateField;
  ecoscore: CandidateField;
  labels: CandidateField<string[]>;
  externalCategories: CandidateField<string[]>;
  countries: CandidateField<string[]>;
  stores: CandidateField<string[]>;
  origins: CandidateField;
  packaging: CandidateField;
  images: CandidateImage[];
  manufacturer: CandidateField;
  servingSize: CandidateField;
  storage: CandidateField;
  vegan: CandidateField;
  vegetarian: CandidateField;
  palmOil: CandidateField;
  pnnsGroup: CandidateField;
  foodGroup: CandidateField;
  nutrientLevels: CandidateField<Record<string, string> | null>;
  embCodes: CandidateField;
  producerLink: CandidateField;
  brandsAll: CandidateField;
  /** OFF completeness 0–100 when available */
  completeness: CandidateField<number | null>;
  /** Extra string attributes for commit (nutrition JSON stringified separately). */
  extraAttributes: Record<string, string>;
  specs: CandidateSpec[];
  similarQuery: SimilarQueryHints;
  /** Slim provider keys for provenance (not full OFF dump). */
  rawSnapshot?: Record<string, unknown> | null;
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

export type SimilarProductHit = {
  barcode: string;
  name: string | null;
  brand: string | null;
  image: string | null;
  provider: ProviderId;
  inCatalogue: boolean;
  localProductId?: string | null;
};

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
  similarProducts?: SimilarProductHit[];
  discoveryId?: string | null;
};

export type ResolveCommitInput = {
  barcode: string;
  format?: BarcodeFormat;
  name: string;
  brand?: string | null;
  brandId?: string | null;
  description?: string | null;
  longDescription?: string | null;
  categoryId: string;
  quantity?: string | null;
  unit?: string | null;
  manufacturer?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  additives?: string | null;
  traces?: string | null;
  packaging?: string | null;
  servingSize?: string | null;
  nutriscore?: string | null;
  novaGroup?: string | null;
  ecoscore?: string | null;
  perishability?: string | null;
  saleUnit?: "each" | "kg" | "g" | "l" | "pack" | null;
  imageUrl?: string | null;
  images?: string[];
  imageRoles?: Array<{ url: string; role: CandidateImage["role"] }>;
  externalCategories?: string[];
  labels?: string[];
  countries?: string[];
  stores?: string[];
  origins?: string | null;
  nutrition?: Record<string, unknown> | null;
  attributes?: Record<string, string>;
  specs?: Array<{ key: string; value: string }>;
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
  duplicateAck?: boolean;
  discoveryId?: string | null;
  /** Allow commit when GTIN checksum fails (admin override). */
  allowInvalidBarcode?: boolean;
  /** Keep as pending_review (default) */
  status?: "draft" | "pending_review";
};

export type DiscoveryCandidateRow = {
  id: string;
  publicId: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  provider: string;
  externalProductId: string | null;
  source: "scan" | "similar" | "search";
  payload: Partial<CandidateProduct> | Record<string, unknown>;
  status: "pending" | "imported" | "dismissed";
  resolvedProductPublicId: string | null;
  similaritySeedBarcode: string | null;
  lastSeenAt: string;
  createdAt: string;
  /** Derived preview fields for list UI */
  preview?: {
    image: string | null;
    quantity: string | null;
    nutriscore: string | null;
    ingredientsPreview: string | null;
    categoryHint: string | null;
    completeness: number;
  };
};

export type DiscoveryStatusCounts = {
  pending: number;
  imported: number;
  dismissed: number;
};
