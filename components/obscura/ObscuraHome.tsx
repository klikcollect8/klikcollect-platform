"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Category, Product } from "@/types";
import Reveal from "@/components/obscura/Reveal";
import ProductCard from "@/components/ProductCard";
import ProductRail from "@/components/marketplace/ProductRail";
import HomepageBanner from "@/components/HomepageBanner";
import FoundingVendors from "@/components/FoundingVendors";

/** Spacious full-width marketplace home */
export default function ObscuraHome({ products }: { products: Product[] }) {
  const featured = products.slice(0, 10);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="w-full bg-[#f7f7f5] text-black">
      <HomepageBanner />

      <div className="mx-auto w-full max-w-[1600px] space-y-16 px-4 py-12 sm:space-y-24 sm:px-10 sm:py-20 lg:space-y-32 lg:px-14 xl:px-20">
        {/* Category rail */}
        <Reveal>
          <section>
            <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10 sm:gap-6">
              <h2 className="min-w-0 text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight">
                Shop by category
              </h2>
              <Link
                href="/categories"
                className="shrink-0 text-[13px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black sm:text-[14px]"
              >
                All →
              </Link>
            </div>
            <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-8 sm:px-0 lg:gap-10">
              {categories.slice(0, 10).map((cat) => {
                const image = cat.image;
                return (
                  <Link
                    key={cat.id || cat.name}
                    href={`/shop?category=${encodeURIComponent(cat.name)}`}
                    className="group flex w-[96px] shrink-0 flex-col items-center gap-3 sm:w-[112px] lg:w-[128px]"
                  >
                    <div className="relative h-[96px] w-[96px] overflow-hidden bg-black/[0.03] sm:h-[112px] sm:w-[112px] lg:h-[128px] lg:w-[128px]">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="128px"
                          unoptimized={image.includes("supabase")}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[18px] font-medium">
                          {cat.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 text-center text-[13px] font-medium leading-snug text-black/55">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <ProductRail
            title="Fresh arrivals"
            href="/shop?sort=newest"
            products={featured}
          />
        </Reveal>

        <Reveal>
          <FoundingVendors />
        </Reveal>

        <Reveal>
          <section className="border-t border-black/[0.06] pt-12 sm:pt-20">
            <div className="mb-8 flex items-end justify-between gap-4 sm:mb-12 sm:gap-6">
              <h2 className="min-w-0 text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight">
                More to explore
              </h2>
              <Link
                href="/shop"
                className="shrink-0 text-[13px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black sm:text-[14px]"
              >
                Shop all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8 xl:gap-y-16">
              {products.slice(0, 15).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
