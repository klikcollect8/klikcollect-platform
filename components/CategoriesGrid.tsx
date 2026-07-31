"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { categoryImage } from "@/lib/category-images";

export default function CategoriesGrid() {
  return (
    <div className="py-10 md:py-16 border-b border-black/5">
      <div className="mb-8 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end md:gap-8">
        <div>
          <h2 className="mb-2 text-2xl font-medium tracking-tight text-black sm:text-3xl md:mb-4 md:text-4xl">
            Shop by Category
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-black/50 md:text-base">
            Explore groceries and everyday essentials by department.
          </p>
        </div>
        <Link
          href="/categories"
          className="hidden items-center gap-3 border-b border-black pb-1 text-sm font-medium uppercase tracking-widest text-black transition-colors hover:text-black/50 md:flex"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6">
        {V1_CATEGORIES.slice(0, 8).map((name) => {
          const image = categoryImage(name);
          return (
            <Link
              key={name}
              href={`/shop?category=${encodeURIComponent(name)}`}
              className="group"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-black/[0.03]">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="240px"
                  />
                ) : null}
              </div>
              <h3 className="mt-3 text-[13px] font-medium tracking-tight text-black">
                {name}
              </h3>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center md:hidden">
        <Link
          href="/categories"
          className="w-full bg-black px-8 py-4 text-center text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-neutral-800"
        >
          View all categories
        </Link>
      </div>
    </div>
  );
}
