"use client";

import { useState, useEffect, useCallback } from "react";
import { Product } from "@/types";
import { useUserAuth } from "./useUserAuth";

export function useWishlist() {
  const { isSignedIn, user } = useUserAuth();
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlist = useCallback(async () => {
    if (!isSignedIn || !user) {
      setWishlist([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user/wishlist");
      if (!res.ok) {
        const stored = localStorage.getItem("wishlist");
        if (stored) setWishlist(JSON.parse(stored));
        return;
      }
      const wishlistData = await res.json();
      if (!Array.isArray(wishlistData) || !wishlistData.length) {
        setWishlist([]);
        return;
      }

      const products: Product[] = [];
      await Promise.all(
        wishlistData.slice(0, 24).map(async (item: { product_id: string }) => {
          try {
            const productResponse = await fetch(
              `/api/products/${item.product_id}`,
            );
            if (productResponse.ok) {
              products.push(await productResponse.json());
            }
          } catch {
            /* skip missing product */
          }
        }),
      );

      setWishlist(products);
      localStorage.setItem("wishlist", JSON.stringify(products));
    } catch {
      const stored = localStorage.getItem("wishlist");
      if (stored) {
        try {
          setWishlist(JSON.parse(stored));
        } catch {
          setWishlist([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user]);

  const addToWishlist = useCallback(
    async (product: Product) => {
      if (!isSignedIn || !user) throw new Error("User must be signed in");

      const response = await fetch("/api/user/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (!response.ok) throw new Error("Failed to add to wishlist");

      setWishlist((prev) => {
        if (prev.some((p) => p.id === product.id)) return prev;
        const next = [product, ...prev];
        localStorage.setItem("wishlist", JSON.stringify(next));
        return next;
      });
    },
    [isSignedIn, user],
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!isSignedIn || !user) throw new Error("User must be signed in");

      const response = await fetch(
        `/api/user/wishlist?product_id=${encodeURIComponent(productId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to remove from wishlist");

      setWishlist((prev) => {
        const next = prev.filter((p) => p.id !== productId);
        localStorage.setItem("wishlist", JSON.stringify(next));
        return next;
      });
    },
    [isSignedIn, user],
  );

  const isInWishlist = useCallback(
    (productId: string) => wishlist.some((p) => p.id === productId),
    [wishlist],
  );

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  return {
    wishlist,
    loading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refresh: loadWishlist,
  };
}
