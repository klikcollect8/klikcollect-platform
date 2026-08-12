import type {
  CandidateProduct,
  ProviderId,
  ProviderLookupResult,
} from "@/lib/product-resolver/types";

export type ProductTypeSupport =
  | "food"
  | "general"
  | "beauty"
  | "pet_food"
  | "any";

export interface ProductDataProvider {
  getProviderName(): ProviderId;
  getSupportedProductTypes(): ProductTypeSupport[];
  getProductByBarcode(barcode: string): Promise<ProviderLookupResult>;
  searchProduct?(
    query: string,
    opts?: { pageSize?: number },
  ): Promise<ProviderLookupResult[]>;
  normaliseResponse(raw: unknown, barcode: string): Partial<CandidateProduct> | null;
}
