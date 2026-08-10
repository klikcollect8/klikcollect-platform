"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import { CartItem, FulfilmentMethod, Product } from "@/types";
import { useUserAuth } from "./useUserAuth";
import {
  capQuantity,
  dedupeCartItems,
  lineKey,
} from "@/lib/cart/lines";

const CART_UPDATED_EVENT = "cart-updated";

export type AddToCartOffer = {
  offerId: string;
  offerPrice: number;
  vendorId: string;
  vendorName: string;
  neighbourhood?: string;
  fulfilment?: FulfilmentMethod;
  deliveryZoneId?: string;
  deliveryZoneLabel?: string;
  deliveryFee?: number;
  /** Optional stock cap for this offer */
  stock?: number;
  /** Canonical variant for multi-variant products */
  variantPublicId?: string;
};

/** Module-level guard - many components call useCart(); one fetch per user. */
let cartFetchUserId: string | null = null;
let cartFetchPromise: Promise<CartItem[]> | null = null;

function readLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("cart");
    const parsed = stored ? JSON.parse(stored) : [];
    return dedupeCartItems(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function fulfilmentBody(item: {
  fulfilment?: FulfilmentMethod;
  deliveryZoneId?: string;
  deliveryZoneLabel?: string;
  deliveryFee?: number;
}) {
  return {
    fulfilment: item.fulfilment || "pickup",
    delivery_zone_id: item.deliveryZoneId ?? null,
    delivery_zone_label: item.deliveryZoneLabel ?? null,
    delivery_fee: item.deliveryFee ?? 0,
  };
}

function stockForLine(
  product: Product,
  offer?: AddToCartOffer,
  existing?: CartItem,
): number | undefined {
  if (typeof offer?.stock === "number") return offer.stock;
  if (typeof existing?.product?.stock === "number") return existing.product.stock;
  if (typeof product.stock === "number") return product.stock;
  return undefined;
}

async function fetchServerCart(userId: string): Promise<CartItem[]> {
  if (cartFetchUserId === userId && cartFetchPromise) {
    return cartFetchPromise;
  }

  cartFetchUserId = userId;
  cartFetchPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const cartResponse = await fetch("/api/user/cart-with-products", {
        signal: controller.signal,
      });
      if (!cartResponse.ok) throw new Error("Failed to fetch cart");
      let items: CartItem[] = await cartResponse.json();
      if (!Array.isArray(items)) items = [];
      items = dedupeCartItems(items);

      const guestItems = readLocalCart();
      if (guestItems.length) {
        const byKey = new Map(items.map((i) => [lineKey(i), i] as const));
        for (const gi of guestItems) {
          const key = lineKey(gi);
          if (!key) continue;
          const existing = byKey.get(key);
          if (existing) {
            const stock = stockForLine(gi.product, undefined, existing);
            const nextQty = capQuantity(
              (existing.quantity || 0) + (gi.quantity || 0),
              stock,
            );
            const merged: CartItem = {
              ...existing,
              ...gi,
              quantity: nextQty,
              fulfilment: gi.fulfilment || existing.fulfilment,
              deliveryZoneId: gi.deliveryZoneId ?? existing.deliveryZoneId,
              deliveryZoneLabel:
                gi.deliveryZoneLabel ?? existing.deliveryZoneLabel,
              deliveryFee: gi.deliveryFee ?? existing.deliveryFee,
            };
            byKey.set(key, merged);
            void fetch("/api/user/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                offer_id: merged.offerId || undefined,
                product_id: merged.product.id,
                quantity: nextQty,
                ...fulfilmentBody(merged),
              }),
            }).catch(() => {});
          } else {
            byKey.set(key, gi);
            void fetch("/api/user/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                offer_id: gi.offerId || undefined,
                product_id: gi.product.id,
                quantity: gi.quantity || 1,
                ...fulfilmentBody(gi),
              }),
            }).catch(() => {});
          }
        }
        items = [...byKey.values()];
        localStorage.removeItem("cart");
      }

      items = dedupeCartItems(items);
      localStorage.setItem("cart", JSON.stringify(items));
      return items;
    } finally {
      clearTimeout(timer);
    }
  })();

  try {
    return await cartFetchPromise;
  } catch (error) {
    cartFetchUserId = null;
    cartFetchPromise = null;
    throw error;
  }
}

export type CartApi = {
  cartItems: CartItem[];
  loading: boolean;
  addToCart: (
    product: Product,
    quantity?: number,
    offer?: AddToCartOffer,
  ) => Promise<boolean>;
  updateQuantity: (productOrOfferId: string, quantity: number) => Promise<void>;
  removeFromCart: (productOrOfferId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  replaceOffer: (lineOfferId: string, next: AddToCartOffer) => Promise<void>;
  reloadCart: () => Promise<void> | void;
};

/** Internal cart state — call once from CartProvider only. */
export function useCartState(): CartApi {
  const { isSignedIn, user, loading: authLoading } = useUserAuth();
  const userId = user?.id || null;
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedForUser = useRef<string | null>(null);

  const loadCart = useCallback(
    async (silent = false) => {
      if (authLoading) return;

      if (!userId || !isSignedIn) {
        setCartItems(readLocalCart());
        setLoading(false);
        loadedForUser.current = null;
        return;
      }

      if (!silent && loadedForUser.current === userId) {
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);

      try {
        const items = await fetchServerCart(userId);
        setCartItems(items);
        loadedForUser.current = userId;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error loading cart:", error);
        }
        setCartItems(readLocalCart());
      } finally {
        setLoading(false);
      }
    },
    [authLoading, isSignedIn, userId],
  );

  const addToCart = useCallback(
    async (
      product: Product,
      quantity: number = 1,
      offer?: AddToCartOffer,
    ): Promise<boolean> => {
      try {
        if (!offer?.offerId) {
          throw new Error("Choose a vendor before adding to bag");
        }

        const fulfilment = offer.fulfilment || "pickup";
        const deliveryMeta =
          fulfilment === "delivery"
            ? {
                deliveryZoneId: offer.deliveryZoneId,
                deliveryZoneLabel: offer.deliveryZoneLabel,
                deliveryFee: offer.deliveryFee ?? 0,
              }
            : {
                deliveryZoneId: undefined,
                deliveryZoneLabel: undefined,
                deliveryFee: 0,
              };

        const existing = cartItems.find(
          (item) => lineKey(item) === offer.offerId,
        );
        const stock = stockForLine(product, offer, existing);
        const existingQty = existing?.quantity || 0;
        const nextQty = capQuantity(existingQty + quantity, stock);
        if (nextQty <= 0) {
          throw new Error("Out of stock");
        }

        const line: CartItem = {
          product: {
            ...product,
            price: offer.offerPrice,
            stock: typeof stock === "number" ? stock : product.stock,
            vendorName: offer.vendorName,
            neighbourhood: offer.neighbourhood,
          },
          quantity: nextQty,
          offerId: offer.offerId,
          variantPublicId: offer.variantPublicId,
          offerPrice: offer.offerPrice,
          vendorId: offer.vendorId,
          vendorName: offer.vendorName,
          neighbourhood: offer.neighbourhood,
          fulfilment,
          ...deliveryMeta,
        };

        if (!userId || !isSignedIn) {
          setCartItems((prev) => {
            const existingIndex = prev.findIndex(
              (item) => lineKey(item) === offer.offerId,
            );
            const updated =
              existingIndex >= 0
                ? prev.map((item, i) =>
                    i === existingIndex
                      ? {
                          ...item,
                          quantity: nextQty,
                          fulfilment,
                          ...deliveryMeta,
                          product: {
                            ...item.product,
                            price: offer.offerPrice,
                            stock:
                              typeof stock === "number"
                                ? stock
                                : item.product.stock,
                          },
                        }
                      : item,
                  )
                : [...prev, line];
            localStorage.setItem("cart", JSON.stringify(updated));
            return updated;
          });
          window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
          return true;
        }

        // Optimistic UI — update bag immediately, sync to server in background
        const previous = cartItems;
        setCartItems((prev) => {
          const existingIndex = prev.findIndex(
            (item) => lineKey(item) === offer.offerId,
          );
          let next: CartItem[];
          if (existingIndex >= 0) {
            next = [...prev];
            next[existingIndex] = {
              ...next[existingIndex],
              quantity: nextQty,
              fulfilment,
              ...deliveryMeta,
              product: {
                ...next[existingIndex].product,
                price: offer.offerPrice,
                stock:
                  typeof stock === "number"
                    ? stock
                    : next[existingIndex].product.stock,
              },
            };
          } else {
            next = [...prev, { ...line, quantity: nextQty }];
          }
          localStorage.setItem("cart", JSON.stringify(next));
          return next;
        });
        window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));

        try {
          const response = await fetch("/api/user/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offer_id: offer.offerId,
              product_id: product.id,
              quantity: nextQty,
              ...fulfilmentBody({ fulfilment, ...deliveryMeta }),
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || `Failed to add to cart (${response.status})`,
            );
          }
          return true;
        } catch (syncError) {
          setCartItems(previous);
          localStorage.setItem("cart", JSON.stringify(previous));
          window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
          throw syncError instanceof Error
            ? syncError
            : new Error("Failed to add to cart");
        }
      } catch (error) {
        console.error("addToCart:", error);
        // Reject so callers can toast the Error message; Buy now catches and skips redirect.
        throw error instanceof Error
          ? error
          : new Error("Failed to add to cart");
      }
    },
    [isSignedIn, userId, cartItems],
  );

  const removeFromCart = useCallback(
    async (productOrOfferId: string) => {
      setCartItems((prev) => {
        const updated = prev.filter(
          (item) =>
            lineKey(item) !== productOrOfferId &&
            item.product.id !== productOrOfferId,
        );
        localStorage.setItem("cart", JSON.stringify(updated));
        return updated;
      });
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));

      if (!userId || !isSignedIn) return;
      void fetch(
        `/api/user/cart?product_id=${encodeURIComponent(productOrOfferId)}`,
        { method: "DELETE" },
      ).catch(() => {});
    },
    [isSignedIn, userId],
  );

  const updateQuantity = useCallback(
    async (productOrOfferId: string, quantity: number) => {
      const target = cartItems.find(
        (item) =>
          lineKey(item) === productOrOfferId ||
          item.product.id === productOrOfferId,
      );
      const capped = capQuantity(quantity, target?.product?.stock);
      if (capped <= 0) {
        await removeFromCart(productOrOfferId);
        return;
      }

      setCartItems((prev) => {
        const updated = dedupeCartItems(
          prev.map((item) =>
            lineKey(item) === productOrOfferId ||
            item.product.id === productOrOfferId
              ? { ...item, quantity: capped }
              : item,
          ),
        );
        localStorage.setItem("cart", JSON.stringify(updated));
        return updated;
      });
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));

      if (!userId || !isSignedIn) return;
      void fetch("/api/user/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: target?.product.id || productOrOfferId,
          offer_id: target?.offerId || productOrOfferId,
          quantity: capped,
          ...fulfilmentBody(target || {}),
        }),
      }).catch(() => {});
    },
    [cartItems, isSignedIn, userId, removeFromCart],
  );

  const clearCart = useCallback(async () => {
    setCartItems([]);
    localStorage.removeItem("cart");
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
    loadedForUser.current = null;
    cartFetchUserId = null;
    cartFetchPromise = null;

    if (!userId || !isSignedIn) return;
    void fetch("/api/user/cart", { method: "DELETE" }).catch(() => {});
  }, [isSignedIn, userId]);

  /** Swap a bag line to another vendor offer (keeps quantity). */
  const replaceOffer = useCallback(
    async (lineOfferId: string, next: AddToCartOffer) => {
      const existing = cartItems.find((i) => lineKey(i) === lineOfferId);
      if (!existing) return;

      const stock = stockForLine(existing.product, next, existing);
      const qty = capQuantity(existing.quantity, stock);
      if (qty <= 0) {
        await removeFromCart(lineOfferId);
        return;
      }

      const fulfilment = next.fulfilment || existing.fulfilment || "pickup";
      const deliveryMeta =
        fulfilment === "delivery"
          ? {
              deliveryZoneId: next.deliveryZoneId ?? existing.deliveryZoneId,
              deliveryZoneLabel:
                next.deliveryZoneLabel ?? existing.deliveryZoneLabel,
              deliveryFee: next.deliveryFee ?? existing.deliveryFee ?? 0,
            }
          : {
              deliveryZoneId: undefined,
              deliveryZoneLabel: undefined,
              deliveryFee: 0,
            };

      const replaced: CartItem = {
        ...existing,
        product: {
          ...existing.product,
          price: next.offerPrice,
          stock: typeof stock === "number" ? stock : existing.product.stock,
          vendorName: next.vendorName,
          neighbourhood: next.neighbourhood,
        },
        offerId: next.offerId,
        offerPrice: next.offerPrice,
        vendorId: next.vendorId,
        vendorName: next.vendorName,
        neighbourhood: next.neighbourhood,
        fulfilment,
        ...deliveryMeta,
        quantity: qty,
      };

      setCartItems((prev) => {
        const without = prev.filter((i) => lineKey(i) !== lineOfferId);
        const mergeIdx = without.findIndex(
          (i) => lineKey(i) === next.offerId,
        );
        let updated: CartItem[];
        if (mergeIdx >= 0) {
          updated = without.map((item, i) =>
            i === mergeIdx
              ? {
                  ...item,
                  quantity: capQuantity(
                    item.quantity + qty,
                    stockForLine(item.product, next, item),
                  ),
                }
              : item,
          );
        } else {
          updated = [...without, replaced];
        }
        localStorage.setItem("cart", JSON.stringify(updated));
        return updated;
      });
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));

      if (!userId || !isSignedIn) return;

      void fetch(
        `/api/user/cart?product_id=${encodeURIComponent(lineOfferId)}`,
        { method: "DELETE" },
      ).catch(() => {});
      void fetch("/api/user/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: next.offerId,
          product_id: existing.product.id,
          quantity: qty,
          ...fulfilmentBody({ fulfilment, ...deliveryMeta }),
        }),
      }).catch(() => {});
    },
    [cartItems, isSignedIn, userId, removeFromCart],
  );

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    const onUpdate = () => setCartItems(readLocalCart());
    window.addEventListener(CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return {
    cartItems,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    replaceOffer,
    reloadCart: () => {
      loadedForUser.current = null;
      cartFetchUserId = null;
      cartFetchPromise = null;
      return loadCart();
    },
  };
}

const CartContext = createContext<CartApi | null>(null);

/** Mount once in root layout so ProductCards share one cart instance. */
export function CartProvider({ children }: { children: ReactNode }) {
  const value = useCartState();
  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
