"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight, Grid3X3 } from "lucide-react";

export default function ShopAllProducts({
  products: initialProducts,
}: {
  products?: Product[];
}) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setAllProducts(initialProducts);
      setTotalCount(initialProducts.length);
      const categoryCounts = initialProducts.reduce(
        (acc, p) => {
          if (p?.category) acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      setCategories(
        Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([c]) => c)
          .slice(0, 10),
      );
      setDisplayProducts(initialProducts.slice(0, 20));
      return;
    }
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        const arr = Array.isArray(data) ? data : [];
        setAllProducts(arr);
        setTotalCount(arr.length);
        const categoryCounts = arr.reduce(
          (acc, p) => {
            if (p?.category) acc[p.category] = (acc[p.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        setCategories(
          Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([c]) => c)
            .slice(0, 10),
        );
        setDisplayProducts(arr.slice(0, 20));
      })
      .catch(() => setAllProducts([]));
  }, [initialProducts]);

  // Update display when category changes
  useEffect(() => {
    if (selectedCategory === "all") {
      setDisplayProducts(allProducts.slice(0, 20));
    } else {
      const filtered = allProducts.filter(
        (p) => p.category === selectedCategory,
      );
      setDisplayProducts(filtered.slice(0, 20));
    }
  }, [selectedCategory, allProducts]);

  if (allProducts.length === 0) return null;

  return (
    <div className="py-16 sm:py-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 px-4 sm:px-0">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-black text-white">
              <Grid3X3 className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold tracking-widest uppercase text-neutral-500">
              Browse Products
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-light text-neutral-900 mb-3 tracking-tight">
            Shop All Products
          </h2>
          <p className="text-neutral-500 text-lg font-light">
            Explore our collection of {totalCount}+ products across all
            categories
          </p>
        </div>

        <Link
          href="/shop"
          className="group flex items-center gap-3 px-6 py-3 rounded-full bg-black text-white hover:bg-neutral-900 transition-all"
        >
          <span className="font-medium text-sm tracking-wide uppercase">
            View All {totalCount} Products
          </span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Category Filter */}
      <div className="mb-8 px-4 sm:px-0 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-black text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 px-4 sm:px-0">
        {displayProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Browse More Link */}
      <div className="mt-12 text-center px-4">
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-neutral-100 text-black font-medium text-sm uppercase tracking-wide hover:bg-neutral-200 transition-colors"
        >
          Browse All Products
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
