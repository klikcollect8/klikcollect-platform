"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { Product } from "@/types";
import { resolveProductImage } from "@/lib/product-image";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { useIsClient } from "@/lib/hooks/useIsClient";

interface WishlistSidebarProps {
  items: Product[];
  onRemoveItem: (productId: string) => void | Promise<void>;
  onClose: () => void;
}

export default function WishlistSidebar({
  items,
  onRemoveItem,
  onClose,
}: WishlistSidebarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const mounted = useIsClient();

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
      aria-label="Saved"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <div className="flex items-baseline gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Saved
            </p>
            <span className="text-[12px] tabular-nums text-black/35">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close saved"
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
            {items.length === 0 ? "Nothing saved yet" : "Your list"}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
            {items.length === 0
              ? "Save products while browsing, then open them to choose a vendor."
              : "Open an item to pick a seller and add it to your bag."}
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
                    { label: "Categories", href: "/categories" },
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
                        <ArrowRight
                          className="h-4 w-4 text-black/20"
                          strokeWidth={1.5}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Browse
                </h2>
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
                        <ArrowRight
                          className="h-4 w-4 text-black/20"
                          strokeWidth={1.5}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <article key={product.id} className="group min-w-0">
                  <Link
                    href={`/products/${product.id}`}
                    onClick={handleClose}
                    className="block"
                  >
                    <div className="relative aspect-square overflow-hidden bg-black/[0.03]">
                      <Image
                        src={resolveProductImage(product.image)}
                        alt={product.name || "Product"}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        sizes="220px"
                      />
                    </div>
                    <h2 className="mt-3 truncate text-[14px] font-medium tracking-tight">
                      {product.name}
                    </h2>
                    <p className="mt-0.5 truncate text-[12px] text-black/40">
                      {product.category}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onRemoveItem(product.id)}
                    className="mt-3 text-[12px] text-black/35 transition-colors hover:text-black"
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-black/10 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          {items.length > 0 ? (
            <Link
              href="/saved"
              onClick={handleClose}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-black underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
            >
              Open saved page
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-black underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
            >
              Continue shopping
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
