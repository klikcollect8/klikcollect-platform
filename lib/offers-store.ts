import type { ProductOffer } from "@/types";
import { majorToMinor } from "./money";
import { readJsonStore, writeJsonStore } from "./json-store";

const FILE = "offers.json";

function normalise(o: ProductOffer): ProductOffer {
  const onHand = Math.max(0, Math.round(o.onHand ?? o.stock ?? 0));
  const reserved = Math.max(0, Math.round(o.reserved ?? 0));
  return {
    ...o,
    onHand,
    reserved,
    stock: Math.max(0, onHand - reserved),
    moneyMinor:
      typeof o.moneyMinor === "number" ? o.moneyMinor : majorToMinor(o.price || 0),
    barcode: o.barcode || o.gtin,
    gtin: o.gtin || o.barcode,
  };
}

async function readAll(): Promise<ProductOffer[]> {
  const data = await readJsonStore<ProductOffer[]>(FILE, []);
  return Array.isArray(data) ? data.map(normalise) : [];
}

async function writeAll(offers: ProductOffer[]): Promise<void> {
  await writeJsonStore(
    FILE,
    offers.map(normalise),
  );
}

export async function listOffers(): Promise<ProductOffer[]> {
  return readAll();
}

export async function listPublishedOffers(): Promise<ProductOffer[]> {
  return (await readAll()).filter((o) => o.status === "published");
}

export async function listOffersForProduct(productId: string): Promise<ProductOffer[]> {
  return (await listPublishedOffers()).filter((o) => o.productId === productId);
}

export async function listOffersForVendor(vendorId: string): Promise<ProductOffer[]> {
  return (await listPublishedOffers()).filter((o) => o.vendorId === vendorId);
}

export async function getOfferById(id: string): Promise<ProductOffer | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) || null;
}

export async function saveOffers(offers: ProductOffer[]): Promise<void> {
  await writeAll(offers);
}

export async function updateOfferStock(
  offerId: string,
  patch: Partial<Pick<ProductOffer, "onHand" | "reserved">>,
): Promise<ProductOffer | null> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === offerId);
  if (idx < 0) return null;
  const next = normalise({
    ...all[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  all[idx] = next;
  await writeAll(all);
  return next;
}
