"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { CartItem, FulfilmentMethod } from "@/types";
import CartPromotions from "@/components/CartPromotions";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";
import { useCartDeliveryQuote } from "@/lib/hooks/useCartDeliveryQuote";
import { DeliveryOptimizeHints } from "@/components/checkout/DeliveryOptimizeHints";
import { getLatestSavedDeliveryPin } from "@/lib/checkout/saved-delivery-pin";
import { useUserLocation } from "@/components/providers/LocationProvider";
import type { MapMarker } from "@/components/map/MapCanvas";

const AdvancedNavMap = dynamic(
  () => import("@/components/map/AdvancedNavMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[200px] items-center justify-center border border-black/10 bg-black/[0.03] text-[11px] uppercase tracking-[0.16em] text-black/35">
        Loading map
      </div>
    ),
  },
);

function linePrice(item: CartItem) {
  return item.offerPrice ?? item.product.price ?? 0;
}
function lineId(item: CartItem) {
  return item.offerId || item.product.id;
}

function CartLineRow({
  item,
  onQty,
  onRemove,
  onSave,
  onMoveFulfilment,
}: {
  item: CartItem;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onSave: (id: string) => void;
  onMoveFulfilment: (id: string, next: FulfilmentMethod) => void;
}) {
  const isDelivery = item.fulfilment === "delivery";
  return (
    <div className="flex gap-5 sm:gap-6">
      <Link
        href={`/products/${item.product.id}${
          item.offerId ? `?offer=${encodeURIComponent(item.offerId)}` : ""
        }`}
        className="relative h-36 w-28 shrink-0 overflow-hidden bg-black/[0.03] sm:h-44 sm:w-36"
      >
        <Image
          src={resolveProductImage(item.product.image)}
          alt={item.product.name || "Product"}
          fill
          className="object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/products/${item.product.id}${
                item.offerId
                  ? `?offer=${encodeURIComponent(item.offerId)}`
                  : ""
              }`}
              className="text-[17px] font-medium leading-snug hover:opacity-55"
            >
              {item.product.name}
            </Link>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
              {item.product.category}
            </p>
            {item.vendorName || item.product.vendorName ? (
              <p className="mt-1 text-[13px] text-black/45">
                Sold by {item.vendorName || item.product.vendorName}
              </p>
            ) : null}
            <p className="mt-1.5 text-[13px] text-black/45">
              {isDelivery
                ? item.deliveryZoneLabel
                  ? `Delivery · ${item.deliveryZoneLabel}`
                  : "Delivery"
                : "Click & collect"}
              {isDelivery && (item.deliveryFee ?? 0) > 0
                ? ` · +${formatPrice(item.deliveryFee!)}`
                : ""}
            </p>
          </div>
          <p className="shrink-0 text-[17px] font-medium tabular-nums">
            {formatPrice(linePrice(item) * item.quantity)}
          </p>
        </div>
        <p className="mt-3 text-[13px] text-black/45">
          {(item.product.stock ?? 0) > 0 ? "In stock" : "Out of stock"}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center border border-black/12">
            <button
              type="button"
              onClick={() => onQty(lineId(item), Math.max(0, item.quantity - 1))}
              className="flex h-10 w-10 items-center justify-center text-black/50 hover:text-black"
              aria-label="Decrease"
            >
              {item.quantity <= 1 ? (
                <Trash2 className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
            </button>
            <span className="min-w-[2.5rem] text-center text-[14px] font-medium tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQty(lineId(item), item.quantity + 1)}
              className="flex h-10 w-10 items-center justify-center text-black/50 hover:text-black disabled:opacity-30"
              disabled={item.quantity >= (item.product.stock ?? 999)}
              aria-label="Increase"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              onMoveFulfilment(lineId(item), isDelivery ? "pickup" : "delivery")
            }
            className="text-[13px] underline underline-offset-4 decoration-black/25 hover:decoration-black"
          >
            {isDelivery ? "Move to pickup" : "Move to delivery"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(lineId(item))}
            className="text-[13px] underline underline-offset-4 decoration-black/25 hover:decoration-black"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => onSave(lineId(item))}
            className="text-[13px] underline underline-offset-4 decoration-black/25 hover:decoration-black"
          >
            Save for later
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const {
    cartItems,
    loading,
    updateQuantity,
    removeFromCart,
    addToCart,
    setLineFulfilment,
  } = useCart();
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const { coords } = useUserLocation();

  const deliveryItems = useMemo(
    () => cartItems.filter((i) => i.fulfilment === "delivery"),
    [cartItems],
  );
  const pickupItems = useMemo(
    () => cartItems.filter((i) => i.fulfilment !== "delivery"),
    [cartItems],
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + linePrice(item) * item.quantity,
    0,
  );
  const {
    deliveryMajor: deliveryTotal,
    quote: deliveryQuote,
    shopCount,
    areaLabel: liveAreaLabel,
    needsLocation,
  } = useCartDeliveryQuote(cartItems);
  const grandTotal = subtotal + deliveryTotal;
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryLabel =
    liveAreaLabel ||
    deliveryItems.find((i) => i.deliveryZoneLabel)?.deliveryZoneLabel;

  const destination = useMemo(() => {
    const pin = getLatestSavedDeliveryPin();
    if (pin?.lat != null && pin?.lng != null) {
      return {
        lng: pin.lng,
        lat: pin.lat,
        label: pin.label || pin.area || "Delivery",
      };
    }
    return null;
  }, [deliveryItems.length]);

  const deliveryMarkers = useMemo((): MapMarker[] => {
    const pins: MapMarker[] = [];
    const seen = new Set<string>();
    for (const item of deliveryItems) {
      const key = item.vendorId || item.vendorName || "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
    }
    return pins;
  }, [deliveryItems]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("savedForLater");
      if (saved) setSavedForLater(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const saveForLater = async (id: string) => {
    const item = cartItems.find((i) => lineId(i) === id);
    if (!item) return;
    const newSaved = [...savedForLater];
    if (!newSaved.some((s) => lineId(s) === id)) {
      newSaved.push(item);
      setSavedForLater(newSaved);
      localStorage.setItem("savedForLater", JSON.stringify(newSaved));
    }
    await removeFromCart(id);
  };

  const removeFromSaved = (id: string) => {
    const next = savedForLater.filter((i) => lineId(i) !== id);
    setSavedForLater(next);
    localStorage.setItem("savedForLater", JSON.stringify(next));
  };

  const moveToCart = async (
    item: CartItem,
    fulfilment?: FulfilmentMethod,
  ) => {
    if (!addToCart || !item.offerId) return;
    const nextFulfilment = fulfilment || item.fulfilment || "pickup";
    await addToCart(item.product, item.quantity, {
      offerId: item.offerId,
      offerPrice: linePrice(item),
      vendorId: item.vendorId || "",
      vendorName: item.vendorName || item.product.vendorName || "",
      neighbourhood: item.neighbourhood,
      fulfilment: nextFulfilment,
      deliveryZoneId:
        nextFulfilment === "delivery" ? item.deliveryZoneId : undefined,
      deliveryZoneLabel:
        nextFulfilment === "delivery"
          ? item.deliveryZoneLabel ||
            (coords ? "Near you" : "Delivery")
          : undefined,
      deliveryFee: nextFulfilment === "delivery" ? item.deliveryFee || 0 : 0,
    });
    removeFromSaved(lineId(item));
  };

  const moveFulfilment = async (id: string, next: FulfilmentMethod) => {
    if (next === "delivery") {
      await setLineFulfilment(id, "delivery", {
        deliveryZoneLabel:
          getLatestSavedDeliveryPin()?.label ||
          (coords ? "Near you" : "Delivery"),
        deliveryFee: 0,
      });
    } else {
      await setLineFulfilment(id, "pickup");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <Loader2 className="h-8 w-8 animate-spin text-black/40" />
      </div>
    );
  }

  if (cartItems.length === 0 && savedForLater.length === 0) {
    return (
      <StorePage narrow>
        <div className="border-t border-black/[0.06] py-24 text-center">
          <ShoppingBag
            className="mx-auto mb-6 h-10 w-10 text-black/20"
            strokeWidth={1.25}
          />
          <h1 className="text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-tight">
            Your bag is empty
          </h1>
          <p className="mt-4 text-[16px] text-black/50">
            Add items when you find something you like.
          </p>
          <Link
            href="/shop"
            className="mt-10 inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
          >
            Continue shopping
          </Link>
        </div>
      </StorePage>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <CartPromotions items={cartItems} />

      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20">
        <StoreHeading
          eyebrow="Bag"
          title="Your bag"
          description={`${itemCount} ${itemCount === 1 ? "item" : "items"}`}
        />

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="space-y-16 lg:col-span-8">
            {deliveryItems.length > 0 ? (
              <section className="space-y-8">
                <div>
                  <h2 className="text-[20px] font-medium tracking-tight">
                    Delivery
                  </h2>
                  <p className="mt-1 text-[13px] text-black/45">
                    Live fee by road distance · pin at checkout
                  </p>
                </div>
                <div className="overflow-hidden">
                  <AdvancedNavMap
                    variant="compact"
                    className="h-[220px] sm:h-[260px]"
                    destination={destination}
                    markers={deliveryMarkers}
                    showSearch={false}
                    showStreetPreview
                    followUserDefault={false}
                    interactive={false}
                  />
                </div>
                <div className="space-y-10 border-t border-black/[0.06] pt-10">
                  {deliveryItems.map((item) => (
                    <CartLineRow
                      key={lineId(item)}
                      item={item}
                      onQty={(id, qty) => void updateQuantity(id, qty)}
                      onRemove={(id) => void removeFromCart(id)}
                      onSave={(id) => void saveForLater(id)}
                      onMoveFulfilment={(id, next) =>
                        void moveFulfilment(id, next)
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-8">
              <div>
                <h2 className="text-[20px] font-medium tracking-tight">
                  Click &amp; collect
                </h2>
                <p className="mt-1 text-[13px] text-black/45">
                  Pick up from the shop
                </p>
              </div>
              {pickupItems.length === 0 ? (
                <p className="border-t border-black/[0.06] pt-8 text-[14px] text-black/40">
                  No pickup items. Move a delivery line here, or add from a
                  product page.
                </p>
              ) : (
                <div className="space-y-10 border-t border-black/[0.06] pt-10">
                  {pickupItems.map((item) => (
                    <CartLineRow
                      key={lineId(item)}
                      item={item}
                      onQty={(id, qty) => void updateQuantity(id, qty)}
                      onRemove={(id) => void removeFromCart(id)}
                      onSave={(id) => void saveForLater(id)}
                      onMoveFulfilment={(id, next) =>
                        void moveFulfilment(id, next)
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-8">
              <div>
                <h2 className="text-[20px] font-medium tracking-tight">
                  Saved for later
                </h2>
                <p className="mt-1 text-[13px] text-black/45">
                  Kept on this device until you move them back
                </p>
              </div>
              {savedForLater.length === 0 ? (
                <p className="border-t border-black/[0.06] pt-8 text-[14px] text-black/40">
                  Nothing saved. Use “Save for later” on a bag line.
                </p>
              ) : (
                <div className="space-y-8 border-t border-black/[0.06] pt-8">
                  {savedForLater.map((item) => (
                    <div key={lineId(item)} className="flex gap-5">
                      <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-black/[0.03]">
                        <Image
                          src={resolveProductImage(item.product.image)}
                          alt={item.product.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium">
                          {item.product.name}
                        </p>
                        {item.vendorName || item.product.vendorName ? (
                          <p className="mt-1 text-[12px] text-black/45">
                            Sold by{" "}
                            {item.vendorName || item.product.vendorName}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[12px] text-black/40">
                          Last as{" "}
                          {item.fulfilment === "delivery"
                            ? "delivery"
                            : "pickup"}
                        </p>
                        <p className="mt-1 text-[15px] tabular-nums">
                          {formatPrice(linePrice(item))}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4">
                          <button
                            type="button"
                            onClick={() => void moveToCart(item)}
                            className="text-[13px] underline underline-offset-4"
                          >
                            Move to bag
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void moveToCart(item, "delivery")
                            }
                            className="text-[13px] underline underline-offset-4"
                          >
                            To delivery
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveToCart(item, "pickup")}
                            className="text-[13px] underline underline-offset-4"
                          >
                            To pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromSaved(lineId(item))}
                            className="text-[13px] text-black/45 underline underline-offset-4"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-28 border border-black/10 bg-[#f7f7f5] p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
                Summary
              </p>
              <p className="mt-4 text-[15px] text-black/50">
                Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
              </p>
              <p className="mt-1 text-[17px] font-medium tabular-nums text-black/70">
                {formatPrice(subtotal)}
              </p>
              {deliveryItems.length > 0 ? (
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/[0.06] pt-4">
                  <div>
                    <p className="text-[14px] text-black/50">
                      Total delivery cost
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/35">
                      {needsLocation
                        ? "Set Deliver to for a road-distance price"
                        : `${
                            deliveryQuote?.distanceKm
                              ? `${deliveryQuote.distanceKm < 1 ? `${Math.round(deliveryQuote.distanceKm * 1000)} m` : `${deliveryQuote.distanceKm.toFixed(1)} km`} · `
                              : ""
                          }${shopCount > 1 ? `${shopCount} stops` : "1 stop"}${
                            deliveryQuote?.etaMinutes
                              ? ` · ~${deliveryQuote.etaMinutes} min`
                              : ""
                          }${deliveryLabel ? ` · ${deliveryLabel}` : ""}`}
                    </p>
                    {deliveryQuote?.adjustments?.length ? (
                      <p className="mt-0.5 text-[11px] text-black/35">
                        {deliveryQuote.adjustments
                          .map((a) => `${a.label} +${a.amountMajor}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[15px] font-medium tabular-nums">
                    {formatPrice(deliveryTotal)}
                  </p>
                </div>
              ) : null}
              <DeliveryOptimizeHints items={cartItems} />
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
                Total
              </p>
              <p className="mt-1 text-[clamp(2rem,3vw,2.75rem)] font-medium tracking-tight tabular-nums">
                {formatPrice(grandTotal)}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-black/40">
                {deliveryItems.length > 0
                  ? "Delivery is priced by road distance · one fee per shop, not per product"
                  : "Mixed bags are fine — confirm pickup or delivery at checkout"}
              </p>
              <Link
                href="/checkout"
                className="mt-8 flex w-full items-center justify-center bg-black py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
              >
                Checkout
              </Link>
              <Link
                href="/shop"
                className="mt-3 flex w-full items-center justify-center border border-black py-4 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-black hover:text-white"
              >
                Keep shopping
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
