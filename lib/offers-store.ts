import { promises as fs } from "fs";
import path from "path";
import type { ProductOffer } from "@/types";
import { majorToMinor } from "./money";

const DATA_DIR = path.join(process.cwd(), ".data");
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

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<ProductOffer[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as ProductOffer[];
    return Array.isArray(data) ? data.map(normalise) : [];
  } catch {
    return [];
  }
}

async function writeAll(offers: ProductOffer[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, FILE),
    JSON.stringify(offers.map(normalise), null, 2),
    "utf8",
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
