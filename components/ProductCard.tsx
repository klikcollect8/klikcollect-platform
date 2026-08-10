"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { Product, ProductOffer, type FulfilmentMethod } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { track } from "@/lib/track";
import { useCart } from "@/lib/hooks/useCart";
import { lineKey } from "@/lib/cart/lines";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  /** When set (vendor storefront), show this vendor's exact price */
  offerPrice?: number;
  /** Prefill / quick-add offer */
  offerId?: string;
  vendorId?: string;
  vendorName?: string;
  neighbourhood?: string;
  stock?: number;
  /** Eager-load image for above-the-fold cards */
  priority?: boolean;
}

type ResolvedOffer = {
  offerId: string;
  offerPrice: number;
  vendorId: string;
  vendorName: string;
  neighbourhood?: string;
  stock?: number;
};

function pickCheapestInStock(offers: ProductOffer[]): ResolvedOffer | null {
  const inStock = offers.filter(
    (o) => o.status === "published" && (o.stock ?? 0) > 0,
  );
  if (!inStock.length) return null;
  const best = inStock.reduce((a, b) => (a.price <= b.price ? a : b));
  return {
    offerId: best.id,
    offerPrice: best.price,
    vendorId: best.vendorId,
    vendorName: best.vendorName,
    neighbourhood: best.neighbourhood,
    stock: best.stock,
  };
}

function sortOffers(offers: ProductOffer[]): ProductOffer[] {
  return [...offers]
    .filter((o) => o.status === "published")
    .sort((a, b) => a.price - b.price);
}

export default function ProductCard({
  product,
  offerPrice,
  offerId,
  vendorId,
  vendorName,
  neighbourhood,
  stock,
  priority = false,
}: ProductCardProps) {
  const { cartItems, addToCart, updateQuantity } = useCart();
  const [busy, setBusy] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [offerList, setOfferList] = useState<ProductOffer[] | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [resolvedOffer, setResolvedOffer] = useState<ResolvedOffer | null>(
    offerId
      ? {
          offerId,
          offerPrice:
            typeof offerPrice === "number" ? offerPrice : product.price ?? 0,
          vendorId: vendorId || "",
          vendorName: vendorName || product.vendorName || "Shop",
          neighbourhood: neighbourhood || product.neighbourhood,
          stock: typeof stock === "number" ? stock : product.stock,
        }
      : null,
  );
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>("pickup");

  const activeOfferId = resolvedOffer?.offerId || offerId;
  const cartQty = useMemo(() => {
    if (!activeOfferId) return 0;
    const line = cartItems.find((item) => lineKey(item) === activeOfferId);
    return line?.quantity || 0;
  }, [cartItems, activeOfferId]);

  const href = activeOfferId
    ? `/products/${product.id}?offer=${encodeURIComponent(activeOfferId)}`
    : `/products/${product.id}`;

  const vendorExact =
    typeof offerPrice === "number" && Number.isFinite(offerPrice);
  const fromPrice =
    !vendorExact &&
    typeof product.price === "number" &&
    Number.isFinite(product.price)
      ? product.price
      : null;
  const shopCount =
    typeof product.offerCount === "number" ? product.offerCount : 0;

  const resolveOffer = async (): Promise<ResolvedOffer | null> => {
    if (resolvedOffer?.offerId) return resolvedOffer;
    if (offerId) {
      const next: ResolvedOffer = {
        offerId,
        offerPrice:
          typeof offerPrice === "number" ? offerPrice : product.price ?? 0,
        vendorId: vendorId || "",
        vendorName: vendorName || product.vendorName || "Shop",
        neighbourhood: neighbourhood || product.neighbourhood,
        stock: typeof stock === "number" ? stock : product.stock,
      };
      setResolvedOffer(next);
      return next;
    }

    const res = await fetch(`/api/products/${product.id}`);
    if (!res.ok) return null;
    const detail = (await res.json()) as Product & { offers?: ProductOffer[] };
    const offers = detail.offers || product.offers || [];
    setOfferList(sortOffers(offers));
    const picked = pickCheapestInStock(offers);
    if (!picked) return null;
    setResolvedOffer(picked);
    return picked;
  };

  const openPriceSheet = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (vendorExact) return;
    setPriceOpen(true);
    if (offerList) return;
    setOffersLoading(true);
    try {
      const existing = product.offers?.length
        ? sortOffers(product.offers)
        : null;
      if (existing?.length) {
        setOfferList(existing);
        return;
      }
      const res = await fetch(`/api/products/${product.id}`);
      if (!res.ok) return;
      const detail = (await res.json()) as Product & {
        offers?: ProductOffer[];
      };
      setOfferList(sortOffers(detail.offers || []));
    } finally {
      setOffersLoading(false);
    }
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const offer = await resolveOffer();
      if (!offer?.offerId) return;

      await addToCart(
        {
          ...product,
          price: offer.offerPrice,
          stock: offer.stock,
          vendorName: offer.vendorName,
          neighbourhood: offer.neighbourhood,
        },
        1,
        {
          offerId: offer.offerId,
          offerPrice: offer.offerPrice,
          vendorId: offer.vendorId,
          vendorName: offer.vendorName,
          neighbourhood: offer.neighbourhood,
          stock: offer.stock,
          fulfilment,
          deliveryZoneLabel:
            fulfilment === "delivery" ? "Delivery" : undefined,
          deliveryFee: fulfilment === "delivery" ? 0 : 0,
        },
      );
    } catch (err) {
      console.error("ProductCard quick-add:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleDec = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeOfferId || busy) return;
    setBusy(true);
    try {
      await updateQuantity(activeOfferId, cartQty - 1);
    } finally {
      setBusy(false);
    }
  };

  const handleInc = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeOfferId || busy) return;
    setBusy(true);
    try {
      await updateQuantity(activeOfferId, cartQty + 1);
    } finally {
      setBusy(false);
    }
  };

  const selectOffer = async (o: ProductOffer) => {
    const next: ResolvedOffer = {
      offerId: o.id,
      offerPrice: o.price,
      vendorId: o.vendorId,
      vendorName: o.vendorName,
      neighbourhood: o.neighbourhood,
      stock: o.stock,
    };
    setResolvedOffer(next);
    setPriceOpen(false);
    setBusy(true);
    try {
      await addToCart(
        {
          ...product,
          price: o.price,
          stock: o.stock,
          vendorName: o.vendorName,
          neighbourhood: o.neighbourhood,
        },
        1,
        {
          offerId: o.id,
          offerPrice: o.price,
          vendorId: o.vendorId,
          vendorName: o.vendorName,
          neighbourhood: o.neighbourhood,
          stock: o.stock,
          fulfilment,
          deliveryZoneLabel:
            fulfilment === "delivery" ? "Delivery" : undefined,
          deliveryFee: 0,
        },
      );
    } finally {
      setBusy(false);
    }
  };

  const qtyChip =
    "rounded-none border border-black/10 bg-white/35 text-black shadow-none backdrop-blur-[1px]";

  const needsOptions = (product.variations?.length || 0) > 0;

  return (
    <article className="group flex h-full flex-col">
      <div className="relative mb-5">
        <Link
          href={href}
          onClick={() =>
            track(
              "storefront.product_clicked",
              { productId: product.id },
              "customer",
            )
          }
          className="relative block aspect-[4/5] overflow-hidden bg-black/[0.03]"
        >
          <Image
            src={resolveProductImage(product.image)}
            alt={product.name || "Product"}
            fill
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/[0.04]" />
        </Link>

        <div className="absolute bottom-2 right-2 z-10">
          {needsOptions ? (
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex h-7 items-center justify-center px-2 text-[10px] font-medium uppercase tracking-[0.12em] ${qtyChip}`}
            >
              Options
            </Link>
          ) : cartQty > 0 && activeOfferId ? (
            <div
              className={`flex items-center ${qtyChip}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy}
                onClick={handleDec}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none text-black/45 transition-opacity active:opacity-35 disabled:opacity-25"
              >
                <Minus className="h-3 w-3" strokeWidth={1.5} />
              </button>
              <span className="min-w-[1rem] text-center text-[11px] font-medium tabular-nums tracking-tight text-black/75">
                {cartQty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy}
                onClick={handleInc}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none text-black/45 transition-opacity active:opacity-35 disabled:opacity-25"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Add to bag"
              disabled={busy}
              onClick={handleAdd}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-none ${qtyChip} transition-opacity active:opacity-45 disabled:opacity-25`}
            >
              <Plus className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <p className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-black/35">
        {product.category || "Catalogue"}
      </p>

      <Link
        href={href}
        className="mb-1.5 line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-black transition-opacity hover:opacity-50"
      >
        {product.name}
      </Link>

      {vendorExact ? (
        <p className="text-[17px] font-medium tabular-nums tracking-tight">
          {formatPrice(offerPrice)}
        </p>
      ) : fromPrice != null ? (
        <button
          type="button"
          onClick={openPriceSheet}
          className="group/price text-left transition-opacity hover:opacity-60"
          aria-label={
            shopCount > 1
              ? `From ${formatPrice(fromPrice)}, ${shopCount} shops — compare prices`
              : `From ${formatPrice(fromPrice)}`
          }
        >
          <p className="text-[17px] font-medium tabular-nums tracking-tight underline decoration-black/15 underline-offset-4 group-hover/price:decoration-black/40">
            <span className="text-[13px] font-normal text-black/40">From </span>
            {formatPrice(fromPrice)}
          </p>
          {shopCount > 1 ? (
            <p className="mt-0.5 text-[12px] text-black/35">
              {shopCount} shops · tap to compare
            </p>
          ) : null}
        </button>
      ) : shopCount > 1 ? (
        <button
          type="button"
          onClick={openPriceSheet}
          className="text-left text-[12px] text-black/35 underline decoration-black/15 underline-offset-2 hover:text-black/55"
        >
          {shopCount} shops · compare
        </button>
      ) : null}

      {!needsOptions ? (
        <div className="mt-3 flex items-center gap-1 border border-black/10 p-0.5">
          {(
            [
              { id: "pickup" as const, label: "Pickup" },
              { id: "delivery" as const, label: "Deliver" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFulfilment(opt.id)}
              className={cn(
                "min-h-7 flex-1 px-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
                fulfilment === opt.id
                  ? "bg-black text-white"
                  : "text-black/45 hover:text-black",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {priceOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={() => setPriceOpen(false)}
              />
              <div className="relative z-10 flex max-h-[78vh] w-full max-w-md flex-col border border-black/10 bg-[#f7f7f5] sm:max-h-[70vh]">
                <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                      Prices
                    </p>
                    <p className="mt-1 truncate text-[16px] font-medium tracking-tight">
                      {product.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPriceOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center text-black/40 hover:text-black"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {offersLoading ? (
                    <p className="px-5 py-10 text-center text-[13px] text-black/40">
                      Loading shops…
                    </p>
                  ) : !offerList?.length ? (
                    <p className="px-5 py-10 text-center text-[13px] text-black/40">
                      No shop prices yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-black/[0.06]">
                      {offerList.map((o, i) => {
                        const out = (o.stock ?? 0) <= 0;
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              disabled={out || busy}
                              onClick={() => void selectOffer(o)}
                              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-medium">
                                  {o.vendorName}
                                  {i === 0 && !out ? (
                                    <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.12em] text-black/35">
                                      Best
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-[12px] text-black/40">
                                  {[o.neighbourhood, out ? "Out of stock" : null]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                    (fulfilment === "delivery"
                                      ? "Delivery available"
                                      : "Click & collect")}
                                </span>
                              </span>
                              <span className="shrink-0 text-[15px] font-medium tabular-nums">
                                {formatPrice(o.price)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="border-t border-black/10 px-5 py-3">
                  <Link
                    href={href}
                    onClick={() => setPriceOpen(false)}
                    className="inline-flex min-h-10 w-full items-center justify-center bg-black text-[11px] font-medium uppercase tracking-[0.14em] text-white"
                  >
                    View product
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
