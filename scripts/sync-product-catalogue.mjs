/**
 * @deprecated Local image pipeline retired.
 * Catalogue imagery lives in Supabase Storage (product-images / category-images / cms-images).
 * Seed metadata is scripts/seed-catalogue.json; reseed with: npm run seed:supabase
 */
console.error(
  "scripts/sync-product-catalogue.mjs is retired. Images are in Supabase Storage.",
);
process.exit(1);
