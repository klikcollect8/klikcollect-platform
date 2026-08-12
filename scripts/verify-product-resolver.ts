/**
 * Offline unit checks for barcode normalisation, merge ranking, and auth gates.
 * Run: npx tsx scripts/verify-product-resolver.ts
 */
import { config } from "dotenv";
config();

import { normaliseBarcode } from "../lib/catalogue/barcode-normalize";
import {
  mergeProviderResults,
  candidateToAttributes,
  mapPerishabilityToDb,
} from "../lib/product-resolver/merge";
import { fieldFromProvider, emptyField } from "../lib/product-resolver/field";
import { roleHasPermission } from "../lib/authz/roles";
import { createOpenFoodFactsProvider } from "../lib/product-resolver/providers/open-food-facts";
import type {
  CandidateProduct,
  ProviderLookupResult,
} from "../lib/product-resolver/types";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function baseCandidate(
  name: string,
  brand: string,
  provider: "open_food_facts" | "klikcollect",
): Partial<CandidateProduct> {
  return {
    barcode: "3017620422003",
    format: "EAN_13",
    name: fieldFromProvider(name, provider),
    brand: fieldFromProvider(brand, provider),
    genericName: emptyField(),
    quantity: fieldFromProvider("400g", provider),
    unit: emptyField(),
    description: emptyField(),
    ingredients: fieldFromProvider("sugar, cocoa", provider),
    allergens: fieldFromProvider("milk", provider),
    additives: emptyField(),
    traces: emptyField(),
    nutrition: fieldFromProvider(
      { "energy-kcal_100g": 539 },
      provider,
    ),
    nutriscore: fieldFromProvider("E", provider),
    novaGroup: fieldFromProvider("4", provider),
    ecoscore: fieldFromProvider("D", provider),
    labels: emptyField(),
    externalCategories: fieldFromProvider(["Spreads"], provider),
    countries: emptyField(),
    stores: emptyField(),
    origins: emptyField(),
    packaging: emptyField(),
    manufacturer: emptyField(),
    servingSize: emptyField(),
    storage: emptyField(),
    vegan: fieldFromProvider("yes", provider),
    vegetarian: fieldFromProvider("yes", provider),
    palmOil: fieldFromProvider("no", provider),
    pnnsGroup: fieldFromProvider("sweet spreads", provider),
    foodGroup: emptyField(),
    nutrientLevels: emptyField(),
    embCodes: emptyField(),
    producerLink: emptyField(),
    brandsAll: fieldFromProvider(brand, provider),
    completeness: fieldFromProvider(72, provider),
    extraAttributes: { nova_group: "4", ecoscore: "D" },
    specs: [{ key: "Energy (kcal/100g)", value: "539" }],
    similarQuery: { brand, searchTerms: `${brand} Spreads` },
    images: [],
    sources: [
      {
        provider,
        externalProductId: "3017620422003",
        sourceUrl: "https://example.com",
        fetchedAt: new Date().toISOString(),
      },
    ],
  };
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
  candidate: baseCandidate("OFF Name", "OFF Brand", "open_food_facts"),
  fetchedAt: new Date().toISOString(),
};

const local: ProviderLookupResult = {
  provider: "klikcollect",
  status: "hit",
  candidate: {
    ...baseCandidate("KC Approved Name", "KC Brand", "klikcollect"),
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
assert(offOnly?.novaGroup.value === "4", "merge keeps nova group");
assert(
  Boolean(offOnly && candidateToAttributes(offOnly).ingredients),
  "candidateToAttributes includes ingredients",
);
assert(
  Boolean(offOnly && candidateToAttributes(offOnly).nutrition_json),
  "candidateToAttributes includes nutrition_json",
);
assert(
  Boolean(offOnly?.similarQuery.searchTerms),
  "similarQuery hints present",
);
assert(
  offOnly != null && candidateToAttributes(offOnly).vegan === "yes",
  "candidateToAttributes includes vegan",
);
assert(
  offOnly != null && candidateToAttributes(offOnly).dietary?.includes("Vegan"),
  "candidateToAttributes dietary aggregates diet flags",
);
assert(
  mapPerishabilityToDb("ambient") === "non_perishable",
  "perishability ambient → non_perishable",
);
assert(
  mapPerishabilityToDb("chilled") === "refrigerated",
  "perishability chilled → refrigerated",
);
assert(
  mapPerishabilityToDb("fresh") === "perishable",
  "perishability fresh → perishable",
);
assert(mapPerishabilityToDb("frozen") === "frozen", "perishability frozen stays");

// —— OFF normaliser: diet tags / unit / storage ——
const offProvider = createOpenFoodFactsProvider();
const normalised = offProvider.normaliseResponse(
  {
    status: 1,
    product: {
      code: "3017620422003",
      product_name: "Test Spread",
      brands: "BrandA, BrandB",
      quantity: "400 g",
      product_quantity: 400,
      product_quantity_unit: "g",
      ingredients_analysis_tags: ["en:vegan", "en:vegetarian", "en:palm-oil-free"],
      pnns_groups_1: "Sugary snacks",
      pnns_groups_2: "Sweets",
      conservation_conditions: "Keep cool and dry",
      nutrient_levels: { fat: "high", salt: "low" },
      nutriments: { "energy-kcal_100g": 100, fiber_100g: 2, "iron_100g": 0.01, "alcohol_100g": 0 },
      emb_codes: "FR 01.001",
      link: "https://example.com/product",
      completeness: 0.81,
    },
  },
  "3017620422003",
);
assert(normalised?.vegan?.value === "yes", "OFF maps vegan tag");
assert(normalised?.palmOil?.value === "no", "OFF maps palm-oil-free → no");
assert(normalised?.unit?.value === "g", "OFF maps product_quantity_unit");
assert(
  normalised?.storage?.value === "Keep cool and dry",
  "OFF maps conservation_conditions",
);
assert(
  normalised?.pnnsGroup?.value === "Sweets",
  "OFF prefers pnns_groups_2",
);
assert(
  Boolean(normalised?.specs?.some((s) => /fibre|fiber/i.test(s.key))),
  "OFF nutrition specs include fibre",
);
assert(
  Boolean(normalised?.specs?.some((s) => /iron|alcohol/i.test(s.key))),
  "OFF nutrition specs include extra nutriments",
);

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
