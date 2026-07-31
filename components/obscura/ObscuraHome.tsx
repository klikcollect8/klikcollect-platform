"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import Reveal from "@/components/obscura/Reveal";
import ProductCard from "@/components/ProductCard";
import ProductRail from "@/components/marketplace/ProductRail";
import HomepageBanner from "@/components/HomepageBanner";
import FoundingVendors from "@/components/FoundingVendors";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { categoryImage } from "@/lib/category-images";

/** Spacious full-width marketplace home */
export default function ObscuraHome({ products }: { products: Product[] }) {
  const featured = products.slice(0, 10);

  return (
    <div className="w-full bg-[#f7f7f5] text-black">
      <HomepageBanner />

      <div className="mx-auto w-full max-w-[1600px] space-y-24 px-6 py-16 sm:px-10 sm:py-20 lg:space-y-32 lg:px-14 xl:px-20">
        {/* Category rail */}
        <Reveal>
          <section>
            <div className="mb-10 flex items-end justify-between gap-6">
              <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight">
                Shop by category
              </h2>
              <Link
                href="/categories"
                className="shrink-0 text-[14px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
              >
                All →
              </Link>
            </div>
            <div className="scrollbar-hide flex gap-8 overflow-x-auto pb-2 lg:gap-10">
              {V1_CATEGORIES.slice(0, 10).map((cat) => {
                const image = categoryImage(cat);
                return (
                  <Link
                    key={cat}
                    href={`/shop?category=${encodeURIComponent(cat)}`}
                    className="group flex w-[112px] shrink-0 flex-col items-center gap-3 lg:w-[128px]"
                  >
                    <div className="relative h-[112px] w-[112px] overflow-hidden bg-black/[0.03] lg:h-[128px] lg:w-[128px]">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="128px"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[18px] font-medium">
                          {cat.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 text-center text-[13px] font-medium leading-snug text-black/55">
                      {cat}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <ProductRail title="Fresh arrivals" href="/shop?sort=newest" products={featured} />
        </Reveal>

        <Reveal>
          <FoundingVendors />
        </Reveal>

        <Reveal>
          <section className="border-t border-black/[0.06] pt-20">
            <div className="mb-12 flex items-end justify-between gap-6">
              <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight">
                More to explore
              </h2>
              <Link
                href="/shop"
                className="shrink-0 text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
              >
                Shop all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8 xl:gap-y-16">
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
