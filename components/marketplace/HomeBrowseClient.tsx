"use client";

import { useMemo, useEffect } from "react";
import Link from "next/link";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { track } from "@/lib/track";

type Props = {
  products: Product[];
  category: string;
  sort: string;
};

export default function HomeBrowseClient({ products, category, sort }: Props) {
  useEffect(() => {
    track("storefront.browse_filtered", { category, sort }, "customer");
  }, [category, sort]);

  const filtered = useMemo(() => {
    let list = products;
    if (category !== "all") {
      list = list.filter(
        (p) => p?.category?.toLowerCase() === category.toLowerCase(),
      );
    }
    if (sort === "rating") {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "price-low") {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sort === "price-high") {
      list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sort === "newest") {
      list = [...list].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    }
    return list;
  }, [products, category, sort]);

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-16 pt-6">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            Catalogue
          </p>
          <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-medium capitalize tracking-tight">
            {category !== "all" ? category.replace(/-/g, " ") : "All products"}
          </h1>
          <p className="mt-2 text-[14px] text-black/55">
            {filtered.length} results · groceries · KES
          </p>
          <div className="mt-4 max-w-md">
            <SearchBar placeholder="Search within results..." />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="border border-black/10 px-6 py-16 text-center">
            <p className="text-black/55">No products match.</p>
            <Link
              href="/"
              className="mt-3 inline-block underline underline-offset-4"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
