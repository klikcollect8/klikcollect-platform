"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/types";
import { useUserLocation } from "@/components/providers/LocationProvider";
import {
  cartDeliveryAreaLabel,
  cartHasDelivery,
  cartVendorIds,
} from "@/lib/checkout/cart-vendors";
import { cartDeliveryTotalMajor } from "@/lib/checkout/delivery-zones";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";

type VendorCoord = {
  vendorId: string;
  lat: number;
  lng: number;
  name?: string;
};

/**
 * Live multi-shop delivery quote for the bag (unique vendors = stops).
 * Falls back to stamped per-line max fee while locating / loading.
 */
export function useCartDeliveryQuote(items: CartItem[]) {
  const { coords, status, track } = useUserLocation();
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [shopCoords, setShopCoords] = useState<VendorCoord[]>([]);

  const wantsDelivery = cartHasDelivery(items);
  const vendorIds = useMemo(
    () => (wantsDelivery ? cartVendorIds(items) : []),
    [items, wantsDelivery],
  );
  const areaLabel = useMemo(
    () => cartDeliveryAreaLabel(items),
    [items],
  );
  const stampedFallback = cartDeliveryTotalMajor(items);

  useEffect(() => {
    if (!wantsDelivery) return;
    if (status === "idle") track();
  }, [wantsDelivery, status, track]);

  // Resolve unique shop coords
  useEffect(() => {
    if (!vendorIds.length) {
      setShopCoords([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/checkout/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorIds }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = (json?.data || []) as Array<{
          vendorId: string;
          lat: number | null;
          lng: number | null;
          name?: string;
        }>;
        setShopCoords(
          list
            .filter(
              (v) =>
                v.lat != null &&
                v.lng != null &&
                Number.isFinite(v.lat) &&
                Number.isFinite(v.lng),
            )
            .map((v) => ({
              vendorId: v.vendorId,
              lat: v.lat as number,
              lng: v.lng as number,
              name: v.name,
            })),
        );
      } catch {
        if (!cancelled) setShopCoords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorIds.join("|")]);

  // Live quote
  useEffect(() => {
    if (!wantsDelivery) {
      setQuote(null);
      setLoading(false);
      return;
    }
    if (!shopCoords.length) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/checkout/delivery-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            fulfilment: "delivery",
            areaLabel,
            drop:
              coords &&
              Number.isFinite(coords.lat) &&
              Number.isFinite(coords.lng)
                ? { lat: coords.lat, lng: coords.lng }
                : null,
            shops: shopCoords.map((s) => ({ lat: s.lat, lng: s.lng })),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const q = (json?.data || null) as DeliveryQuote | null;
        if (q && typeof q.deliveryMinor === "number") {
          setQuote(q);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    wantsDelivery,
    shopCoords,
    coords?.lat,
    coords?.lng,
    areaLabel,
  ]);

  const deliveryMajor = wantsDelivery
    ? quote
      ? quote.deliveryMinor / 100
      : stampedFallback
    : 0;

  return {
    quote,
    deliveryMajor,
    loading,
    wantsDelivery,
    shopCount: shopCoords.length || vendorIds.length,
    areaLabel,
    locating: wantsDelivery && !coords && status === "locating",
  };
}
