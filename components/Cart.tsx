"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus, ArrowRight } from "lucide-react";
import { CartItem, Product } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { V1_CATEGORIES } from "@/lib/curation-policy";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (
    productId: string,
    quantity: number,
  ) => void | Promise<void>;
  onRemoveItem: (productId: string) => void | Promise<void>;
  onAddToCart?: (product: Product, quantity: number) => void | Promise<void>;
  onClose: () => void;
}

export default function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClose,
}: CartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const linePrice = (item: CartItem) =>
    item.offerPrice ?? item.product.price ?? 0;
  const lineId = (item: CartItem) => item.offerId || item.product.id;
  const total = items.reduce(
    (sum, item) => sum + linePrice(item) * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!mounted || typeof document === "undefined") return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bag"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <div className="flex items-baseline gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Bag
            </p>
            <span className="text-[12px] tabular-nums text-black/35">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close bag"
          >
            <span className="hidden sm:inline">Esc</span>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        <div
          className={`mt-6 shrink-0 border-b border-black/15 pb-5 transition-all duration-500 ease-out sm:mt-8 sm:pb-6 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
            {items.length === 0 ? "Your bag is empty" : "Ready for pickup"}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
            {items.length === 0
              ? "Browse the marketplace and add what you need."
              : "Review your items, then checkout for click & collect."}
          </p>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto pb-8 pt-8 scrollbar-hide transition-all duration-500 ease-out sm:pt-10 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {items.length === 0 ? (
            <div className="grid gap-14 sm:grid-cols-2 sm:gap-16 lg:gap-24">
              <section>
                <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Start here
                </h2>
                <ul>
                  {[
                    { label: "Shop all", href: "/shop" },
                    { label: "Today’s deals", href: "/todays-deals" },
                    { label: "Vendors near you", href: "/brands" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={handleClose}
                        className="flex w-full items-center justify-between border-b border-black/[0.06] py-3.5 transition-opacity hover:opacity-45"
                      >
                        <span className="text-[16px] font-medium tracking-tight text-black">
                          {link.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-black/20" strokeWidth={1.5} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    Browse
                  </h2>
                  <Link
                    href="/categories"
                    onClick={handleClose}
                    className="text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black"
                  >
                    All
                  </Link>
                </div>
                <ul>
                  {V1_CATEGORIES.slice(0, 6).map((cat) => (
                    <li key={cat}>
                      <Link
                        href={`/shop?category=${encodeURIComponent(cat)}`}
                        onClick={handleClose}
                        className="flex w-full items-center justify-between border-b border-black/[0.06] py-3.5 transition-opacity hover:opacity-45"
                      >
                        <span className="text-[15px] tracking-tight text-black/75">
                          {cat}
                        </span>
                        <ArrowRight className="h-4 w-4 text-black/20" strokeWidth={1.5} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="space-y-0">
              {items
                .filter((item) => item.product)
                .map((item) => {
                  const href = `/products/${item.product.id}${
                    item.offerId ? `?offer=${encodeURIComponent(item.offerId)}` : ""
                  }`;
                  return (
                    <article
                      key={lineId(item)}
                      className="grid grid-cols-[88px_1fr] gap-5 border-b border-black/[0.06] py-6 sm:grid-cols-[112px_1fr] sm:gap-7 sm:py-8"
                    >
                      <Link
                        href={href}
                        onClick={handleClose}
                        className="relative aspect-square overflow-hidden bg-black/[0.03]"
                      >
                        <Image
                          src={resolveProductImage(item.product.image)}
                          alt={item.product.name || "Product"}
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-col justify-between">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Link
                              href={href}
                              onClick={handleClose}
                              className="block text-[15px] font-medium leading-snug tracking-tight text-black transition-opacity hover:opacity-50 sm:text-[16px]"
                            >
                              {item.product.name}
                            </Link>
                            <p className="mt-1.5 text-[12px] text-black/40">
                              {item.product.category}
                              {(item.vendorName || item.product.vendorName)
                                ? ` · ${item.vendorName || item.product.vendorName}`
                                : ""}
                              {" · "}
                              {item.fulfilment === "delivery"
                                ? "Delivery"
                                : "Click & collect"}
                            </p>
                            <p className="mt-1 text-[13px] tabular-nums text-black/50">
                              {formatPrice(linePrice(item))} each
                            </p>
                          </div>
                          <p className="shrink-0 text-[15px] font-medium tabular-nums tracking-tight text-black sm:text-[16px]">
                            {formatPrice(linePrice(item) * item.quantity)}
                          </p>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-4">
                          <div className="inline-flex items-center border-b border-black/20">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQuantity(
                                  lineId(item),
                                  Math.max(0, item.quantity - 1),
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center text-black/45 transition-colors hover:text-black disabled:opacity-25"
                              disabled={item.quantity <= 1}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <span className="min-w-[2rem] text-center text-[14px] font-medium tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQuantity(lineId(item), item.quantity + 1)
                              }
                              className="flex h-9 w-9 items-center justify-center text-black/45 transition-colors hover:text-black"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveItem(lineId(item))}
                            className="text-[12px] text-black/35 underline underline-offset-[4px] decoration-black/15 transition-colors hover:text-black hover:decoration-black"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <footer
            className={`shrink-0 border-t border-black/10 bg-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 transition-all duration-500 ease-out sm:pt-6 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Subtotal
                </p>
                <p className="mt-1 text-[12px] text-black/40">
                  Taxes calculated at checkout
                </p>
              </div>
              <p className="text-[clamp(1.35rem,2.5vw,1.75rem)] font-medium tracking-tight tabular-nums text-black">
                {formatPrice(total)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/cart"
                onClick={handleClose}
                className="flex items-center justify-center border border-black/20 px-4 py-3.5 text-[13px] font-medium text-black transition-colors hover:border-black hover:bg-black hover:text-white sm:py-4"
              >
                View bag
              </Link>
              <Link
                href="/checkout"
                onClick={handleClose}
                className="inline-flex items-center justify-center gap-2 bg-black px-4 py-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80 sm:py-4"
              >
                Checkout
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </div>
          </footer>
        ) : (
          <footer className="shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-black underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
            >
              Continue shopping
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </footer>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
