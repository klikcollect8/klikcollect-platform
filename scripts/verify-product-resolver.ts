/**
 * Offline unit checks for barcode normalisation, merge ranking, and auth gates.
 * Run: npx tsx scripts/verify-product-resolver.ts
 */
import { config } from "dotenv";
config();

import { normaliseBarcode } from "../lib/catalogue/barcode-normalize";
import { mergeProviderResults } from "../lib/product-resolver/merge";
import { fieldFromProvider, emptyField } from "../lib/product-resolver/field";
import { roleHasPermission } from "../lib/authz/roles";
import type { ProviderLookupResult } from "../lib/product-resolver/types";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// —— Barcode normalisation ——
assert(
  normaliseBarcode("  3017620422003  ").value === "3017620422003",
  "trims whitespace, keeps string",
);
assert(
  normaliseBarcode("012345678905").value === "012345678905",
  "preserves leading zeros (UPC-A)",
);
assert(
  normaliseBarcode("012345678905").format === "UPC_A",
  "detects UPC-A (12 digits)",
);
assert(
  normaliseBarcode("3017620422003").format === "EAN_13",
  "detects EAN-13",
);
assert(
  normaliseBarcode("3017620422003").checksumOk === true,
  "valid Nutella EAN-13 checksum",
);
assert(
  !normaliseBarcode("3017620422004").valid,
  "rejects bad EAN-13 checksum",
);
assert(
  normaliseBarcode("5901234123457-").value === "5901234123457",
  "strips separators",
);
assert(
  !normaliseBarcode("abc!!").valid,
  "rejects invalid characters",
);
assert(
  !normaliseBarcode("ABC123", { requireGtin: true }).valid,
  "requireGtin rejects alphanumeric",
);

// —— Merge: KlikCollect beats OFF ——
const off: ProviderLookupResult = {
  provider: "open_food_facts",
  status: "hit",
  candidate: {
    barcode: "3017620422003",
    format: "EAN_13",
    name: fieldFromProvider("OFF Name", "open_food_facts"),
    brand: fieldFromProvider("OFF Brand", "open_food_facts"),
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
    labels: emptyField(),
    externalCategories: emptyField(),
    countries: emptyField(),
    packaging: emptyField(),
    images: [],
    manufacturer: emptyField(),
    servingSize: emptyField(),
    sources: [
      {
        provider: "open_food_facts",
        externalProductId: "3017620422003",
        sourceUrl: "https://world.openfoodfacts.org/product/3017620422003",
        fetchedAt: new Date().toISOString(),
      },
    ],
  },
  fetchedAt: new Date().toISOString(),
};

const local: ProviderLookupResult = {
  provider: "klikcollect",
  status: "hit",
  candidate: {
    ...off.candidate!,
    name: fieldFromProvider("KC Approved Name", "klikcollect"),
    brand: fieldFromProvider("KC Brand", "klikcollect"),
    sources: [
      {
        provider: "klikcollect",
        externalProductId: "prod_1",
        sourceUrl: null,
        fetchedAt: new Date().toISOString(),
      },
    ],
  },
  fetchedAt: new Date().toISOString(),
};

const merged = mergeProviderResults("3017620422003", "EAN_13", [off, local]);
assert(merged?.name.value === "KC Approved Name", "merge prefers KlikCollect name");
assert(merged?.brand.value === "KC Brand", "merge prefers KlikCollect brand");

const offOnly = mergeProviderResults("3017620422003", "EAN_13", [off]);
assert(offOnly?.name.value === "OFF Name", "OFF used when no local");

// —— Auth gates for resolve/commit ——
assert(
  roleHasPermission("platform_admin", "barcode:scan"),
  "platform_admin can scan barcodes",
);
assert(
  roleHasPermission("platform_admin", "products:create"),
  "platform_admin can create products (commit)",
);
assert(
  !roleHasPermission("cashier", "products:create"),
  "cashier cannot commit resolver products",
);
assert(
  !roleHasPermission("support_agent", "products:create"),
  "support_agent cannot commit resolver products",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll product-resolver offline checks passed.");
