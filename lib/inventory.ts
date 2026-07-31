import { promises as fs } from "fs";
import path from "path";
import { publicId } from "./ids";
import {
  getCatalogueProduct,
  listCatalogue,
  mutateCatalogueProduct,
  type CatalogueProduct,
} from "./catalogue-store";

const DATA_DIR = path.join(process.cwd(), ".data");
const MOVEMENTS_FILE = "inventory-movements.jsonl";

export type InventoryMovement = {
  id: string;
  productId: string;
  vendorId: string;
  type: "adjust" | "reserve" | "release" | "commit" | "sale";
  /** Delta to on_hand (negative = decrement). */
  onHandDelta: number;
  /** Delta to reserved (positive = more reserved). */
  reservedDelta: number;
  reason: string;
  refType?: "order" | "pos" | "manual";
  refId?: string;
  createdAt: string;
  actorUserId?: string;
};

export function availableOf(p: Pick<CatalogueProduct, "onHand" | "reserved" | "stock">): number {
  const onHand = p.onHand ?? p.stock ?? 0;
  const reserved = p.reserved ?? 0;
  return Math.max(0, onHand - reserved);
}

async function appendMovement(m: InventoryMovement) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(path.join(DATA_DIR, MOVEMENTS_FILE), JSON.stringify(m) + "\n", "utf8");
}

export async function listMovements(limit = 100): Promise<InventoryMovement[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, MOVEMENTS_FILE), "utf8");
    const lines = raw.split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as InventoryMovement)
      .reverse();
  } catch {
    return [];
  }
}

/**
 * INV-7: atomic conditional reserve.
 * available = on_hand − reserved; fails if qty > available.
 */
export async function reserveStock(input: {
  productId: string;
  quantity: number;
  refType: "order" | "pos";
  refId: string;
  actorUserId?: string;
}): Promise<{ ok: true; product: CatalogueProduct } | { ok: false; code: string; message: string }> {
  const qty = Math.round(input.quantity);
  if (qty <= 0) return { ok: false, code: "INVALID", message: "quantity must be positive" };

  const product = await getCatalogueProduct(input.productId);
  if (!product) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  const available = availableOf(product);
  if (qty > available) {
    return {
      ok: false,
      code: "INSUFFICIENT",
      message: `Only ${available} available for ${product.name}`,
    };
  }

  const onHand = product.onHand ?? product.stock ?? 0;
  const reserved = (product.reserved ?? 0) + qty;
  const updated = await mutateCatalogueProduct(input.productId, {
    onHand,
    reserved,
    stock: onHand - reserved,
  });
  if (!updated) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  await appendMovement({
    id: publicId("mov"),
    productId: input.productId,
    vendorId: updated.vendorId,
    type: "reserve",
    onHandDelta: 0,
    reservedDelta: qty,
    reason: `Reserve for ${input.refType}`,
    refType: input.refType,
    refId: input.refId,
    createdAt: new Date().toISOString(),
    actorUserId: input.actorUserId,
  });

  return { ok: true, product: updated };
}

/** Release a prior reservation (cancel / expiry). */
export async function releaseStock(input: {
  productId: string;
  quantity: number;
  refType: "order" | "pos" | "manual";
  refId: string;
  actorUserId?: string;
}): Promise<{ ok: true; product: CatalogueProduct } | { ok: false; code: string; message: string }> {
  const qty = Math.round(input.quantity);
  if (qty <= 0) return { ok: false, code: "INVALID", message: "quantity must be positive" };

  const product = await getCatalogueProduct(input.productId);
  if (!product) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  const onHand = product.onHand ?? product.stock ?? 0;
  const reserved = Math.max(0, (product.reserved ?? 0) - qty);
  const updated = await mutateCatalogueProduct(input.productId, {
    onHand,
    reserved,
    stock: onHand - reserved,
  });
  if (!updated) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  await appendMovement({
    id: publicId("mov"),
    productId: input.productId,
    vendorId: updated.vendorId,
    type: "release",
    onHandDelta: 0,
    reservedDelta: -qty,
    reason: `Release for ${input.refType}`,
    refType: input.refType,
    refId: input.refId,
    createdAt: new Date().toISOString(),
    actorUserId: input.actorUserId,
  });

  return { ok: true, product: updated };
}

/**
 * Commit reserved stock (order collected / POS sale):
 * on_hand -= qty, reserved -= qty.
 */
export async function commitStock(input: {
  productId: string;
  quantity: number;
  refType: "order" | "pos";
  refId: string;
  actorUserId?: string;
  /** If true, decrement on_hand without requiring a prior reserve (POS path). */
  directSale?: boolean;
}): Promise<{ ok: true; product: CatalogueProduct } | { ok: false; code: string; message: string }> {
  const qty = Math.round(input.quantity);
  if (qty <= 0) return { ok: false, code: "INVALID", message: "quantity must be positive" };

  const product = await getCatalogueProduct(input.productId);
  if (!product) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  let onHand = product.onHand ?? product.stock ?? 0;
  let reserved = product.reserved ?? 0;

  if (input.directSale) {
    const available = onHand - reserved;
    if (qty > available) {
      return {
        ok: false,
        code: "INSUFFICIENT",
        message: `Only ${available} available for ${product.name}`,
      };
    }
    onHand -= qty;
  } else {
    if (qty > reserved) {
      // Allow commit up to reserved; if under-reserved, treat remainder as direct
      const fromReserved = reserved;
      const remainder = qty - fromReserved;
      if (remainder > onHand - reserved) {
        return {
          ok: false,
          code: "INSUFFICIENT",
          message: `Cannot commit ${qty} for ${product.name}`,
        };
      }
      reserved = 0;
      onHand -= qty;
    } else {
      reserved -= qty;
      onHand -= qty;
    }
  }

  const updated = await mutateCatalogueProduct(input.productId, {
    onHand: Math.max(0, onHand),
    reserved: Math.max(0, reserved),
    stock: Math.max(0, onHand - reserved),
  });
  if (!updated) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

  await appendMovement({
    id: publicId("mov"),
    productId: input.productId,
    vendorId: updated.vendorId,
    type: input.directSale ? "sale" : "commit",
    onHandDelta: -qty,
    reservedDelta: input.directSale ? 0 : -Math.min(qty, product.reserved ?? 0),
    reason: input.directSale ? "POS sale (money-free)" : `Commit for ${input.refType}`,
    refType: input.refType,
    refId: input.refId,
    createdAt: new Date().toISOString(),
    actorUserId: input.actorUserId,
  });

  return { ok: true, product: updated };
}

/** Manual on-hand adjustment (vendor inventory board). */
export async function adjustOnHand(input: {
  productId: string;
  onHand: number;
  actorUserId?: string;
}): Promise<CatalogueProduct | null> {
  const product = await getCatalogueProduct(input.productId);
  if (!product) return null;
  const onHand = Math.max(0, Math.round(input.onHand));
  const reserved = Math.min(product.reserved ?? 0, onHand);
  const prev = product.onHand ?? product.stock ?? 0;
  const updated = await mutateCatalogueProduct(input.productId, {
    onHand,
    reserved,
    stock: onHand - reserved,
  });
  if (!updated) return null;
  await appendMovement({
    id: publicId("mov"),
    productId: input.productId,
    vendorId: updated.vendorId,
    type: "adjust",
    onHandDelta: onHand - prev,
    reservedDelta: reserved - (product.reserved ?? 0),
    reason: "Manual on-hand adjustment",
    refType: "manual",
    createdAt: new Date().toISOString(),
    actorUserId: input.actorUserId,
  });
  return updated;
}

export async function findByBarcode(raw: string): Promise<CatalogueProduct | null> {
  const { normaliseBarcode } = await import("./barcode");
  const gtin = normaliseBarcode(raw);
  if (!gtin) return null;
  const all = await listCatalogue();
  return (
    all.find((p) => p.barcode === gtin || p.gtin === gtin) ||
    all.find((p) => normaliseBarcode(p.barcode || "") === gtin) ||
    null
  );
}
