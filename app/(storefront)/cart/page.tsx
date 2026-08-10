"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { CartItem } from "@/types";
import CartPromotions from "@/components/CartPromotions";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";
import { useCartDeliveryQuote } from "@/lib/hooks/useCartDeliveryQuote";
import { DeliveryOptimizeHints } from "@/components/checkout/DeliveryOptimizeHints";

function linePrice(item: CartItem) {
  return item.offerPrice ?? item.product.price ?? 0;
}
function lineId(item: CartItem) {
  return item.offerId || item.product.id;
}

export default function CartPage() {
  const { cartItems, loading, updateQuantity, removeFromCart, addToCart } =
    useCart();
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + linePrice(item) * item.quantity,
    0,
  );
  const {
    deliveryMajor: deliveryTotal,
    quote: deliveryQuote,
    shopCount,
    areaLabel: liveAreaLabel,
  } = useCartDeliveryQuote(cartItems);
  const grandTotal = subtotal + deliveryTotal;
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryLabel =
    liveAreaLabel ||
    cartItems.find(
      (i) => i.fulfilment === "delivery" && i.deliveryZoneLabel,
    )?.deliveryZoneLabel;

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

  const moveToCart = async (item: CartItem) => {
    if (!addToCart || !item.offerId) return;
    await addToCart(item.product, item.quantity, {
      offerId: item.offerId,
      offerPrice: linePrice(item),
      vendorId: item.vendorId || "",
      vendorName: item.vendorName || item.product.vendorName || "",
      neighbourhood: item.neighbourhood,
      fulfilment: item.fulfilment,
      deliveryZoneId: item.deliveryZoneId,
      deliveryZoneLabel: item.deliveryZoneLabel,
      deliveryFee: item.deliveryFee,
    });
    removeFromSaved(lineId(item));
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
            <div className="space-y-10 border-t border-black/[0.06] pt-10">
              {cartItems.map((item) => (
                <div key={lineId(item)} className="flex gap-5 sm:gap-6">
                  <Link
                    href={`/products/${item.product.id}${
                      item.offerId
                        ? `?offer=${encodeURIComponent(item.offerId)}`
                        : ""
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
                          {item.fulfilment === "delivery"
                            ? item.deliveryZoneLabel
                              ? `Delivery · ${item.deliveryZoneLabel}`
                              : "Delivery"
                            : "Click & collect"}
                          {item.fulfilment === "delivery" &&
                          (item.deliveryFee ?? 0) > 0
                            ? ` · +${formatPrice(item.deliveryFee!)}`
                            : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[17px] font-medium tabular-nums">
                        {formatPrice(linePrice(item) * item.quantity)}
                      </p>
                    </div>
                    <p className="mt-3 text-[13px] text-black/45">
                      {(item.product.stock ?? 0) > 0
                        ? "In stock"
                        : "Out of stock"}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-4">
                      <div className="inline-flex items-center border border-black/12">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              lineId(item),
                              Math.max(0, item.quantity - 1),
                            )
                          }
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
                          onClick={() =>
                            updateQuantity(lineId(item), item.quantity + 1)
                          }
                          className="flex h-10 w-10 items-center justify-center text-black/50 hover:text-black disabled:opacity-30"
                          disabled={
                            item.quantity >= (item.product.stock ?? 999)
                          }
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(lineId(item))}
                        className="text-[13px] underline underline-offset-4 decoration-black/25 hover:decoration-black"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => saveForLater(lineId(item))}
                        className="text-[13px] underline underline-offset-4 decoration-black/25 hover:decoration-black"
                      >
                        Save for later
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {savedForLater.length > 0 ? (
              <div>
                <h2 className="mb-8 text-[20px] font-medium tracking-tight">
                  Saved for later
                </h2>
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
                            Sold by {item.vendorName || item.product.vendorName}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[15px] tabular-nums">
                          {formatPrice(linePrice(item))}
                        </p>
                        <div className="mt-3 flex gap-4">
                          <button
                            type="button"
                            onClick={() => moveToCart(item)}
                            className="text-[13px] underline underline-offset-4"
                          >
                            Move to bag
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
              </div>
            ) : null}
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
              {deliveryTotal > 0 ? (
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/[0.06] pt-4">
                  <div>
                    <p className="text-[14px] text-black/50">
                      Total delivery cost
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/35">
                      {shopCount > 1 ? `${shopCount} shops` : "1 shop"}
                      {deliveryLabel ? ` · ${deliveryLabel}` : ""}
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
                {deliveryTotal > 0
                  ? "Delivery is priced by road distance · one fee per shop, not per product"
                  : "Choose delivery or pickup at checkout"}
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
