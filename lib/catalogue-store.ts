import type { Product } from "@/types";
import { publicId } from "./ids";
import { majorToMinor } from "./money";
import { DEMO_VENDOR_ID } from "./tenancy";
import { readJsonStore, writeJsonStore } from "./json-store";

export { DEMO_VENDOR_ID };

const FILE = "vendor-catalogue.json";

export type CatalogueProduct = Omit<Product, "price" | "stock"> & {
  vendorId: string;
  vendorName?: string;
  neighbourhood?: string;
  /** Offer / listing price (always set on catalogue rows). */
  price: number;
  /** INV-1: integer KES cents alongside legacy major-unit `price`. */
  moneyMinor: number;
  /** INV-7 physical units on hand. */
  onHand: number;
  /** INV-7 units reserved for open orders. */
  reserved: number;
  /** GTIN / barcode (digits). */
  barcode?: string;
  gtin?: string;
  /**
   * Legacy alias: available = onHand − reserved.
   * Kept so marketplace UI keeps reading `stock`.
   */
  stock: number;
};

function normalise(p: Partial<CatalogueProduct> & Product & { vendorId: string }): CatalogueProduct {
  const onHand = Math.max(
    0,
    Math.round(
      typeof p.onHand === "number"
        ? p.onHand
        : typeof p.stock === "number"
          ? p.stock
          : 0,
    ),
  );
  const reserved = Math.max(0, Math.round(p.reserved ?? 0));
  const available = Math.max(0, onHand - reserved);
  return {
    ...(p as CatalogueProduct),
    onHand,
    reserved,
    stock: available,
    moneyMinor:
      typeof p.moneyMinor === "number" ? p.moneyMinor : majorToMinor(p.price || 0),
    barcode: p.barcode || p.gtin,
    gtin: p.gtin || p.barcode,
  };
}

async function readAll(): Promise<CatalogueProduct[]> {
  const data = await readJsonStore<CatalogueProduct[]>(FILE, []);
  if (!Array.isArray(data)) return [];
  return data.map((p) => normalise(p));
}

async function writeAll(products: CatalogueProduct[]): Promise<void> {
  await writeJsonStore(
    FILE,
    products.map((p) => normalise(p)),
  );
}

export async function listCatalogue(vendorId?: string): Promise<CatalogueProduct[]> {
  const all = await readAll();
  if (!vendorId) return all;
  return all.filter((p) => p.vendorId === vendorId);
}

export async function getCatalogueProduct(id: string): Promise<CatalogueProduct | null> {
  const all = await readAll();
  return all.find((p) => p.id === id) || null;
}

export type CatalogueInput = {
  name: string;
  description?: string;
  category: string;
  priceMajor: number;
  stock: number;
  image?: string;
  vendorId?: string;
  status?: Product["status"];
  barcode?: string;
};

export async function addCatalogueProduct(input: CatalogueInput): Promise<CatalogueProduct> {
  const now = new Date().toISOString();
  const price = Math.round(input.priceMajor);
  const onHand = Math.max(0, Math.round(input.stock));
  const product = normalise({
    id: publicId("prd"),
    vendorId: input.vendorId || DEMO_VENDOR_ID,
    name: input.name.trim(),
    description: (input.description || input.name).trim(),
    longDescription: input.description?.trim(),
    price,
    moneyMinor: majorToMinor(price),
    image:
      input.image ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
    images: [],
    category: input.category.trim(),
    stock: onHand,
    onHand,
    reserved: 0,
    barcode: input.barcode,
    gtin: input.barcode,
    status: input.status || "published",
    badges: ["New"],
    rating: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const all = await readAll();
  all.unshift(product);
  await writeAll(all);
  void import("./commerce-sync").then((m) =>
    m.syncCatalogueToSupabase(product.vendorId).catch(() => {}),
  );
  return product;
}

export async function addCatalogueProducts(
  inputs: CatalogueInput[],
): Promise<CatalogueProduct[]> {
  const created: CatalogueProduct[] = [];
  for (const input of inputs) {
    created.push(await addCatalogueProduct(input));
  }
  return created;
}

export async function updateCatalogueStatus(
  ids: string[],
  status: Product["status"],
): Promise<number> {
  const all = await readAll();
  let n = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < all.length; i++) {
    if (!ids.includes(all[i].id)) continue;
    all[i] = { ...all[i], status: status || "draft", updatedAt: now };
    n += 1;
  }
  if (n) {
    await writeAll(all);
    void import("./commerce-sync").then((m) =>
      m.syncCatalogueToSupabase().catch(() => {}),
    );
  }
  return n;
}

/** Set absolute on-hand (manual). reserved clamped; stock = available. */
export async function updateCatalogueStock(
  id: string,
  stock: number,
): Promise<CatalogueProduct | null> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const onHand = Math.max(0, Math.round(stock));
  const reserved = Math.min(all[idx].reserved ?? 0, onHand);
  return mutateCatalogueProduct(id, {
    onHand,
    reserved,
    stock: onHand - reserved,
  });
}

export async function mutateCatalogueProduct(
  id: string,
  patch: Partial<Pick<CatalogueProduct, "onHand" | "reserved" | "stock" | "barcode" | "gtin">>,
): Promise<CatalogueProduct | null> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const next = normalise({
    ...all[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  next.badges =
    availableBadge(next) <= 5
      ? ["Low stock"]
      : (all[idx].badges || []).filter((b) => b !== "Low stock" && b !== "Curated");
  all[idx] = next;
  await writeAll(all);
  void import("./commerce-sync").then((m) =>
    m.syncCatalogueToSupabase(all[idx].vendorId).catch(() => {}),
  );
  return all[idx];
}

function availableBadge(p: CatalogueProduct) {
  return Math.max(0, (p.onHand ?? 0) - (p.reserved ?? 0));
}

export async function setProductBarcode(
  id: string,
  barcode: string,
): Promise<CatalogueProduct | null> {
  return mutateCatalogueProduct(id, { barcode, gtin: barcode });
}
