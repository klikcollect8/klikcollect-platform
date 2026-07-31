"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Product } from "@/types";
import { resolveProductImage } from "@/lib/product-image";
import { track } from "@/lib/track";

type ProductRailProps = {
  title: string;
  subtitle?: string;
  href?: string;
  products: Product[];
};

export default function ProductRail({ title, subtitle, href, products }: ProductRailProps) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!products.length) return null;

  const scroll = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
  };

  return (
    <section className="relative w-full">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight text-black">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-[15px] text-black/45">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {href ? (
            <Link
              href={href}
              className="hidden text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black sm:inline"
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

      <div ref={scroller} className="scrollbar-hide flex gap-6 overflow-x-auto pb-2 lg:gap-8">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            onClick={() =>
              track("storefront.product_clicked", { productId: product.id }, "customer")
            }
            className="group w-[200px] shrink-0 sm:w-[240px] lg:w-[260px]"
          >
            <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-black/[0.03]">
              <Image
                src={resolveProductImage(product.image)}
                alt={product.name || "Product"}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                sizes="260px"
              />
            </div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-black/35">
              {product.category || "Catalogue"}
            </p>
            <p className="line-clamp-2 text-[15px] font-medium leading-snug text-black">
              {product.name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
