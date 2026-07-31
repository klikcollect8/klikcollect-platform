/**
 * Founding-cohort seed — unique grocery products + multi-vendor offers.
 * Catalogue images synced from assets/products via scripts/sync-product-catalogue.mjs
 */
import type { CurationApplication } from "./curation-policy";
import type { Product, ProductOffer } from "@/types";
import type { CatalogueProduct } from "./catalogue-store";
import { majorToMinor } from "./money";
import { listApplications, saveApplications } from "./m1-store";
import { saveProducts } from "./products-store";
import { saveOffers } from "./offers-store";
import { FOUNDING_VENDORS, vendorForCategory } from "./founding-vendors";
import catalogue from "./seed-catalogue.json";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

type CatalogueRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMajor: number;
  image: string;
  slug: string;
};

const CANONICAL_PRODUCTS = catalogue as CatalogueRow[];

/** Secondary generalist vendors that also stock selected specialty items */
const SECONDARY_BY_CATEGORY: Record<string, string> = {
  "Fresh Produce": "ven_everyday_basket",
  "Dairy & Eggs": "ven_everyday_basket",
  Pantry: "ven_everyday_basket",
  Beverages: "ven_sip_house",
  Snacks: "ven_crunch_corner",
  Groceries: "ven_home_staples",
  "General Essentials": "ven_clean_living",
  "Household Essentials": "ven_home_staples",
  "Home & Kitchen": "ven_home_staples",
  "Health & Wellness (non-prescription)": "ven_home_staples",
};

function buildOfferDefs(): Array<{
  productId: string;
  vendorId: string;
  priceMajor: number;
  stock: number;
}> {
  const defs: Array<{
    productId: string;
    vendorId: string;
    priceMajor: number;
    stock: number;
  }> = [];

  CANONICAL_PRODUCTS.forEach((p, i) => {
    const primary = vendorForCategory(p.category);
    if (!primary) return;

    defs.push({
      productId: p.id,
      vendorId: primary.id,
      priceMajor: p.priceMajor,
      stock: 20 + (i % 40),
    });

    // Every third product also offered by a related secondary vendor (± price)
    const secondaryId = SECONDARY_BY_CATEGORY[p.category];
    if (secondaryId && secondaryId !== primary.id && i % 3 === 0) {
      const delta = i % 2 === 0 ? -40 : 60;
      defs.push({
        productId: p.id,
        vendorId: secondaryId,
        priceMajor: Math.max(50, p.priceMajor + delta),
        stock: 12 + (i % 18),
      });
    }
  });

  return defs;
}

function makeDemoGtin(index: number): string {
  const base = `62910415${String(1000 + index).slice(-4)}`;
  let sum = 0;
  const reversed = base.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const n = Number(reversed[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + String(check);
}

function buildProducts(): Product[] {
  const now = new Date().toISOString();
  return CANONICAL_PRODUCTS.map((p, i) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    longDescription: p.description,
    image: p.image,
    images: [p.image],
    category: p.category,
    status: "published" as const,
    badges: [],
    rating: 4.4 + (i % 5) * 0.1,
    reviewCount: 8 + i * 2,
    createdAt: now,
    updatedAt: now,
  }));
}

function buildOffers(): ProductOffer[] {
  const now = new Date().toISOString();
  const offerDefs = buildOfferDefs();
  return offerDefs.map((o, i) => {
    const vendor = FOUNDING_VENDORS.find((v) => v.id === o.vendorId)!;
    const barcode = makeDemoGtin(i);
    return {
      id: `off_${o.productId}_${o.vendorId}`,
      productId: o.productId,
      vendorId: o.vendorId,
      vendorName: vendor.name,
      neighbourhood: vendor.neighbourhood,
      price: o.priceMajor,
      moneyMinor: majorToMinor(o.priceMajor),
      onHand: o.stock,
      reserved: 0,
      stock: o.stock,
      status: "published" as const,
      barcode,
      gtin: barcode,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/** Flattened legacy catalogue for Vendor OS inventory UIs */
function buildLegacyCatalogue(
  products: Product[],
  offers: ProductOffer[],
): CatalogueProduct[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return offers.map((o) => {
    const p = byId.get(o.productId)!;
    return {
      ...p,
      id: o.id,
      vendorId: o.vendorId,
      vendorName: o.vendorName,
      neighbourhood: o.neighbourhood,
      price: o.price,
      moneyMinor: o.moneyMinor,
      onHand: o.onHand,
      reserved: o.reserved,
      stock: o.stock,
      barcode: o.barcode,
      gtin: o.gtin,
      badges: o.stock <= 5 ? ["Low stock"] : [],
    };
  });
}

export async function ensureNairobiSeed(): Promise<{
  products: number;
  offers: number;
  applications: number;
  vendors: number;
}> {
  const products = buildProducts();
  const offers = buildOffers();
  await saveProducts(products);
  await saveOffers(offers);

  const legacy = buildLegacyCatalogue(products, offers);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, "vendor-catalogue.json"),
    JSON.stringify(legacy, null, 2),
    "utf8",
  );

  const admittedTemplate: CurationApplication[] = FOUNDING_VENDORS.map((v, i) => ({
    id: v.id,
    businessName: v.name,
    neighbourhood: v.neighbourhood,
    contactEmail: v.email,
    contactPhone: `+2547${String(10000000 + i).slice(0, 8)}`,
    categories: [v.specialty],
    notes: v.tagline,
    status: "admitted" as const,
    createdAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
    decision: {
      decidedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      decidedBy: "founder-curator",
      outcome: "admitted" as const,
      criteriaChecked: [
        "product_quality",
        "photography",
        "descriptions",
        "legitimacy",
      ],
      reason: `Founding cohort admit — ${v.tagline}`,
    },
  }));

  const pendingTemplate: CurationApplication[] = [
    {
      id: "ven_bjc9ibnix1mh3ba5",
      businessName: "Soko Studio",
      neighbourhood: "Ngong Road",
      contactEmail: "apply@sokostudio.ke",
      contactPhone: "+254712345678",
      categories: ["Groceries"],
      notes: "Local produce stall applying for click & collect — awaiting review.",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ven_pending_kawa",
      businessName: "Kawa Collective",
      neighbourhood: "Loresho",
      contactEmail: "hello@kawa.ke",
      contactPhone: "+254722111222",
      categories: ["Pantry", "Beverages"],
      notes: "Specialty tea and pantry staples.",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ];

  const foundingIds = new Set(FOUNDING_VENDORS.map((v) => v.id));
  const templateIds = new Set(pendingTemplate.map((a) => a.id));
  const existing = await listApplications();
  const extras = existing.filter(
    (a) => !foundingIds.has(a.id) && !templateIds.has(a.id),
  );
  const apps = [...pendingTemplate, ...admittedTemplate, ...extras];
  await saveApplications(apps);

  await fs.writeFile(
    path.join(DATA_DIR, "vendors.json"),
    JSON.stringify(FOUNDING_VENDORS, null, 2),
    "utf8",
  );

  return {
    products: products.length,
    offers: offers.length,
    applications: apps.length,
    vendors: FOUNDING_VENDORS.length,
  };
}

export { FOUNDING_VENDORS as VENDORS, CANONICAL_PRODUCTS as PRODUCTS };
