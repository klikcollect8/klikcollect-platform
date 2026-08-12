"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/types";
import { useUserLocation } from "@/components/providers/LocationProvider";
import { useActiveLocation } from "@/components/providers/ActiveLocationProvider";
import {
  cartDeliveryAreaLabel,
  cartHasDelivery,
  cartVendorIds,
} from "@/lib/checkout/cart-vendors";
import { cartDeliveryTotalMajor } from "@/lib/checkout/delivery-zones";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";
import { GPS_USABLE_ACCURACY_M } from "@/lib/location/types";
import { isInKenyaBbox } from "@/lib/location/validate";

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
  const { coords, status } = useUserLocation();
  const { active } = useActiveLocation();
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

  // Confirmed "Deliver to" wins. Raw GPS is only used when it's a tight
  // Kenya fix — never a city-level IP guess.
  const gpsUsable =
    coords != null &&
    status === "ready" &&
    (coords.accuracy ?? 999) <= GPS_USABLE_ACCURACY_M &&
    isInKenyaBbox(coords.lat, coords.lng);
  const dropLat = active?.lat ?? (gpsUsable ? coords!.lat : null);
  const dropLng = active?.lng ?? (gpsUsable ? coords!.lng : null);

  // Do not auto-start GPS from the bag — that overwrote vendor maps and
  // quoted the wrong neighbourhood. User sets location via Deliver to.

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

  // Live quote — debounce GPS jitter so we don't storm the API
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

    const timer = window.setTimeout(() => {
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
                dropLat != null &&
                dropLng != null &&
                Number.isFinite(dropLat) &&
                Number.isFinite(dropLng)
                  ? { lat: dropLat, lng: dropLng }
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
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    wantsDelivery,
    shopCoords,
    dropLat,
    dropLng,
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
    locating: false,
    needsLocation: wantsDelivery && dropLat == null,
  };
}
