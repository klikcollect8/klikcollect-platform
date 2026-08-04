"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TrendingProducts({
  products: initialProducts,
  section,
}: {
  products?: Product[];
  section?: { title?: string; subtitle?: string; productIds?: string[] };
}) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      if (section?.productIds && section.productIds.length > 0) {
        setProducts(
          initialProducts.filter((p) => section.productIds!.includes(p.id)),
        );
      } else {
        setProducts(
          [...initialProducts]
            .sort(
              (a, b) =>
                (b.reviewCount || 0) * (b.rating || 0) -
                (a.reviewCount || 0) * (a.rating || 0),
            )
            .slice(0, 8),
        );
      }
      return;
    }
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        if (section?.productIds && section.productIds.length > 0) {
          setProducts(
            arr.filter((p: Product) => section.productIds!.includes(p.id)),
          );
        } else {
          setProducts(
            [...arr]
              .sort(
                (a: Product, b: Product) =>
                  (b.reviewCount || 0) * (b.rating || 0) -
                  (a.reviewCount || 0) * (a.rating || 0),
              )
              .slice(0, 8),
          );
        }
      })
      .catch(() => setProducts([]));
  }, [section?.productIds, initialProducts]);

  if (products.length === 0) return null;

  return (
    <div className="py-8 sm:py-12 md:py-16 bg-gray-50 rounded-2xl sm:rounded-[40px] px-4 sm:px-6 md:px-12 my-4 sm:my-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-4 sm:gap-6">
        <div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-light text-gray-900 mb-2 sm:mb-3 tracking-tight leading-tight">
            {section?.title || "Trending Now"}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 font-medium tracking-wide uppercase leading-snug">
            {section?.subtitle || "Most loved by our community"}
          </p>
        </div>
        <Link
          href="/shop"
          className="hidden md:flex group items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 hover:text-gray-600 transition-colors"
        >
          View All
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Products Grid - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Products Horizontal Scroll - Mobile */}
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-4 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="snap-start shrink-0"
            style={{ width: "42vw" }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* View All - Mobile (matches desktop style) */}
      <div className="md:hidden mt-6">
        <Link
          href="/shop"
          className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 hover:text-gray-600 transition-colors"
        >
          View All
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
