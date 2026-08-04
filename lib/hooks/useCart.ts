"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CartItem, FulfilmentMethod, Product } from "@/types";
import { useUserAuth } from "./useUserAuth";

const CART_UPDATED_EVENT = "cart-updated";

export type AddToCartOffer = {
  offerId: string;
  offerPrice: number;
  vendorId: string;
  vendorName: string;
  neighbourhood?: string;
  fulfilment?: FulfilmentMethod;
};

/** Module-level guard - many components call useCart(); one fetch per user. */
let cartFetchUserId: string | null = null;
let cartFetchPromise: Promise<CartItem[]> | null = null;

function lineKey(item: CartItem): string {
  return item.offerId || item.product?.id || "";
}

function dedupeCartItems(items: CartItem[]): CartItem[] {
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
        const existingKeys = new Set(items.map(lineKey));
        for (const gi of guestItems) {
          const key = lineKey(gi);
          if (key && !existingKeys.has(key)) {
            items.push(gi);
            existingKeys.add(key);
            void fetch("/api/user/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                offer_id: gi.offerId || undefined,
                product_id: gi.product.id,
                quantity: gi.quantity || 1,
              }),
            }).catch(() => {});
          } else if (key && existingKeys.has(key)) {
            // Guest qty already represented server-side — drop local only.
          }
        }
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

export function useCart() {
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
    async (product: Product, quantity: number = 1, offer?: AddToCartOffer) => {
      if (!offer?.offerId) {
        throw new Error("Choose a vendor before adding to bag");
      }

      const fulfilment = offer.fulfilment || "pickup";
      const line: CartItem = {
        product: {
          ...product,
          price: offer.offerPrice,
          vendorName: offer.vendorName,
          neighbourhood: offer.neighbourhood,
        },
        quantity,
        offerId: offer.offerId,
        offerPrice: offer.offerPrice,
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        neighbourhood: offer.neighbourhood,
        fulfilment,
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
                        quantity: item.quantity + quantity,
                        fulfilment,
                      }
                    : item,
                )
              : [...prev, line];
          localStorage.setItem("cart", JSON.stringify(updated));
          return updated;
        });
        window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
        return;
      }

      const existingQty =
        cartItems.find((item) => lineKey(item) === offer.offerId)?.quantity ||
        0;
      const nextQty = existingQty + quantity;

      const response = await fetch("/api/user/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: offer.offerId,
          product_id: product.id,
          quantity: nextQty,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to add to cart (${response.status})`,
        );
      }

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
          };
        } else {
          next = [...prev, { ...line, quantity: nextQty }];
        }
        localStorage.setItem("cart", JSON.stringify(next));
        return next;
      });
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
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
      if (quantity <= 0) {
        await removeFromCart(productOrOfferId);
        return;
      }

      const target = cartItems.find(
        (item) =>
          lineKey(item) === productOrOfferId ||
          item.product.id === productOrOfferId,
      );

      setCartItems((prev) => {
        const updated = dedupeCartItems(
          prev.map((item) =>
            lineKey(item) === productOrOfferId ||
            item.product.id === productOrOfferId
              ? { ...item, quantity }
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
          quantity,
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
    reloadCart: () => {
      loadedForUser.current = null;
      cartFetchUserId = null;
      cartFetchPromise = null;
      return loadCart();
    },
  };
}
