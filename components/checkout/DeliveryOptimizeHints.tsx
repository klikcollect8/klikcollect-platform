"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/types";
import { useUserLocation } from "@/components/providers/LocationProvider";
import { useCart, type AddToCartOffer } from "@/lib/hooks/useCart";
import {
  cartDeliveryAreaLabel,
  cartHasDelivery,
} from "@/lib/checkout/cart-vendors";
import type { DeliverySuggestion } from "@/lib/checkout/delivery-optimize";
import { formatPrice } from "@/lib/currency";

type Props = {
  items: CartItem[];
  compact?: boolean;
};

export function DeliveryOptimizeHints({ items, compact }: Props) {
  const { coords, status, track } = useUserLocation();
  const { replaceOffer, addToCart } = useCart();
  const [suggestions, setSuggestions] = useState<DeliverySuggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const wantsDelivery = cartHasDelivery(items);
  const areaLabel = useMemo(() => cartDeliveryAreaLabel(items), [items]);
  const linesKey = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.offerId}:${i.vendorId}:${i.offerPrice ?? i.product.price}:${i.quantity}`,
        )
        .join("|"),
    [items],
  );

  useEffect(() => {
    if (!wantsDelivery) return;
    if (status === "idle") track();
  }, [wantsDelivery, status, track]);

  useEffect(() => {
    if (!wantsDelivery || !coords) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch("/api/checkout/delivery-optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            areaLabel,
            drop: { lat: coords.lat, lng: coords.lng },
            lines: items
              .filter((i) => i.offerId && i.vendorId)
              .map((i) => ({
                productId: i.product.id,
                productName: i.product.name,
                offerId: i.offerId!,
                vendorId: i.vendorId!,
                vendorName: i.vendorName || i.product.vendorName,
                offerPrice: i.offerPrice ?? i.product.price ?? 0,
                quantity: i.quantity,
              })),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = (json?.data?.suggestions || []) as DeliverySuggestion[];
        setSuggestions(Array.isArray(list) ? list : []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSuggestions([]);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [wantsDelivery, coords?.lat, coords?.lng, areaLabel, linesKey]);

  if (!wantsDelivery || !suggestions.length) return null;

  const apply = async (s: DeliverySuggestion) => {
    const id = s.kind === "switch_vendor" ? s.lineOfferId : s.offerId;
    setBusyId(id);
    try {
      if (s.kind === "switch_vendor" && replaceOffer) {
        await replaceOffer(s.lineOfferId, {
          offerId: s.newOffer.offerId,
          offerPrice: s.newOffer.offerPrice,
          vendorId: s.newOffer.vendorId,
          vendorName: s.newOffer.vendorName,
          neighbourhood: s.newOffer.neighbourhood,
          fulfilment: "delivery",
        });
      } else if (s.kind === "avoid_stop" && addToCart) {
        const offer: AddToCartOffer = {
          offerId: s.offerId,
          offerPrice: s.offerPrice,
          vendorId: s.vendorId,
          vendorName: s.vendorName,
          neighbourhood: s.neighbourhood,
          fulfilment: "delivery",
        };
        await addToCart(
          {
            id: s.productId,
            name: s.productName,
            description: "",
            image: s.image || "/placeholder.png",
            category: "",
            status: "published",
            price: s.offerPrice,
            vendorName: s.vendorName,
            neighbourhood: s.neighbourhood,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          1,
          offer,
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={compact ? "space-y-2 pt-1" : "mt-4 space-y-2"}>
      {suggestions.map((s) => {
        const key =
          s.kind === "switch_vendor"
            ? `sw-${s.lineOfferId}-${s.newOffer.offerId}`
            : `av-${s.offerId}`;
        const busy =
          busyId ===
          (s.kind === "switch_vendor" ? s.lineOfferId : s.offerId);
        return (
          <div
            key={key}
            className="flex items-start justify-between gap-3 border-t border-black/[0.06] pt-3"
          >
            <p className="min-w-0 text-[12px] leading-snug text-black/55">
              {s.message}
              {s.kind === "switch_vendor" ? (
                <span className="mt-0.5 block text-[11px] text-black/35">
                  Save {formatPrice(s.saveMajor)}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply(s)}
              className="shrink-0 text-[12px] font-medium underline underline-offset-4 decoration-black/25 hover:decoration-black disabled:opacity-40"
            >
              {busy
                ? "…"
                : s.kind === "switch_vendor"
                  ? "Switch"
                  : "Add"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
