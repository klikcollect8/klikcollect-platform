"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";

type ProductRailProps = {
  title: string;
  subtitle?: string;
  href?: string;
  products: Product[];
};

export default function ProductRail({
  title,
  subtitle,
  href,
  products,
}: ProductRailProps) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!products.length) return null;

  const scroll = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
  };

  return (
    <section className="relative w-full">
      <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10 sm:gap-6">
        <div className="min-w-0">
          <h2 className="text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight text-black">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-[14px] text-black/45 sm:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {href ? (
            <Link
              href={href}
              className="shrink-0 text-[13px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black sm:text-[14px]"
            >
              See all →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="hidden h-11 w-11 items-center justify-center border border-black/10 bg-transparent transition-colors hover:bg-black hover:text-white md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="hidden h-11 w-11 items-center justify-center border border-black/10 bg-transparent transition-colors hover:bg-black hover:text-white md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-6 sm:px-0 lg:gap-8"
      >
        {products.map((product) => {
          const offerId = (product as { offerId?: string }).offerId;
          return (
            <div
              key={product.id}
              className="w-[42vw] max-w-[220px] shrink-0 sm:w-[200px]"
            >
              <ProductCard
                product={product}
                offerId={offerId}
                offerPrice={product.price}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
