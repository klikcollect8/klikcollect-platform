/**
 * @deprecated Local `.data` seeding is retired.
 * Use `npm run seed:supabase` (`scripts/seed-supabase-catalogue.ts`) instead.
 * Catalogue truth lives in Supabase.
 */

import { getAdmittedVendors } from "@/lib/admitted-vendors";

/** @deprecated Prefer getAdmittedVendors() */
export async function ensureNairobiSeed(): Promise<{
  products: number;
  offers: number;
  vendors: number;
}> {
  console.warn(
    "[seed-nairobi] ensureNairobiSeed is a no-op - catalogue is seeded via scripts/seed-supabase-catalogue.ts",
  );
  const vendors = await getAdmittedVendors();
  return { products: 0, offers: 0, vendors: vendors.length };
}

/** @deprecated Prefer getAdmittedVendors() */
export const VENDORS: Array<{ id: string; name: string; slug: string }> = [];

/** @deprecated */
export const PRODUCTS: unknown[] = [];
