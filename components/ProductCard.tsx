"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { Product, ProductOffer } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { track } from "@/lib/track";
import { useCart } from "@/lib/hooks/useCart";
import { lineKey } from "@/lib/cart/lines";

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
    const picked = pickCheapestInStock(detail.offers || product.offers || []);
    if (!picked) return null;
    setResolvedOffer(picked);
    return picked;
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
          fulfilment: "pickup",
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

        <div className="absolute bottom-3 right-3 z-10">
          {cartQty > 0 && activeOfferId ? (
            <div
              className="flex items-center rounded-full border border-black/10 bg-white/90 text-black shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy}
                onClick={handleDec}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-black/55 transition-opacity active:opacity-50 disabled:opacity-35"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <span className="min-w-[1.5rem] text-center text-[13px] font-medium tabular-nums tracking-tight">
                {cartQty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy}
                onClick={handleInc}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-black/55 transition-opacity active:opacity-50 disabled:opacity-35"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Add to bag"
              disabled={busy}
              onClick={handleAdd}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-black/10 bg-white/90 text-black shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md transition-opacity active:opacity-60 disabled:opacity-35"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
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
        <div>
          <p className="text-[17px] font-medium tabular-nums tracking-tight">
            <span className="text-[13px] font-normal text-black/40">From </span>
            {formatPrice(fromPrice)}
          </p>
          {shopCount > 1 ? (
            <p className="mt-0.5 text-[12px] text-black/35">
              {shopCount} shops
            </p>
          ) : null}
        </div>
      ) : shopCount > 1 ? (
        <p className="text-[12px] text-black/35">{shopCount} shops</p>
      ) : null}
    </article>
  );
}
