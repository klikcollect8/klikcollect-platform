/**
 * Canonical products - Supabase-backed.
 */
import type { Product } from "@/types";
import {
  sbGetProductDetail,
  sbGetUnifiedCatalogue,
} from "@/lib/supabase-catalogue";

export type CanonicalProduct = Product;

export async function listProducts(): Promise<CanonicalProduct[]> {
  return sbGetUnifiedCatalogue();
}

export async function listAllProducts(): Promise<CanonicalProduct[]> {
  return sbGetUnifiedCatalogue();
}

export async function getProductById(
  id: string,
): Promise<CanonicalProduct | null> {
  const detail = await sbGetProductDetail(id);
  if (!detail) return null;
  const { offers: _offers, ...product } = detail;
  return product;
}

export async function saveProducts(
  _products: CanonicalProduct[],
): Promise<void> {
  throw new Error(
    "saveProducts is retired - mutate products via Supabase admin / seed script",
  );
}
