import type { CartItem } from "@/types";

/** Stable key for a cart line (prefer offer, else product). */
export function lineKey(item: {
  offerId?: string;
  product?: { id?: string };
}): string {
  return item.offerId || item.product?.id || "";
}

/** Merge duplicate offer/product lines by summing quantities. */
export function dedupeCartItems(items: CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();
  for (const item of items) {
    if (!item?.product?.id) continue;
    const key = lineKey(item);
    if (!key) continue;
    const prev = byKey.get(key);
    if (prev) {
      byKey.set(key, {
        ...prev,
        ...item,
        quantity: (prev.quantity || 0) + (item.quantity || 0),
      });
    } else {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/** Unit price for a cart line (offer snapshot, else product price). */
export function linePrice(item: CartItem): number {
  return item.offerPrice ?? item.product?.price ?? 0;
}

/** Cap qty to known stock; unknown stock leaves qty unbounded (non-negative). */
export function capQuantity(qty: number, stock?: number | null): number {
  const n = Number(qty);
  if (!Number.isFinite(n)) return 0;
  if (typeof stock === "number" && Number.isFinite(stock)) {
    return Math.max(0, Math.min(n, stock));
  }
  return Math.max(0, n);
}
