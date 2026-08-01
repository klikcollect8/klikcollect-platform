"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import { Filter, ChevronDown, X } from "lucide-react";
import { track } from "@/lib/track";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

const PRODUCTS_PER_PAGE = 24;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b px-1 py-2 text-[14px] font-medium transition-colors ${
        active ? "border-black text-black" : "border-transparent text-black/40 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function ShopInner() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    track("storefront.shop_viewed", { market: "Nairobi" }, "customer");
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
      return true;
    });

    switch (sortBy) {
      case "rating":
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        result = [...result].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
    }
    return result;
  }, [products, selectedCategory, sortBy]);

  useEffect(() => setVisibleCount(PRODUCTS_PER_PAGE), [filteredProducts.length]);

  const clearAll = () => setSelectedCategory("all");

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  if (loading) {
    return (
      <StorePage>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse bg-black/[0.04]" />
          ))}
        </div>
      </StorePage>
    );
  }

  return (
    <StorePage className="pb-24">
      <StoreHeading
        eyebrow="Shop"
        title={selectedCategory !== "all" ? selectedCategory : "Catalogue"}
        description={`${filteredProducts.length} items`}
        action={
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none border border-black/12 bg-transparent py-3 pl-4 pr-10 text-[14px] focus:border-black/40 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="rating">Top rated</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 sm:mb-10 sm:gap-x-5">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex min-h-11 items-center gap-2 border border-black/12 px-4 py-2.5 text-[13px] font-medium md:hidden"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <div className="hidden flex-wrap items-center gap-x-5 gap-y-3 md:flex">
          <Chip active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>
            All ({products.length})
          </Chip>
          {categories.slice(0, 10).map((cat) => (
            <Chip
              key={cat}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>
        {selectedCategory !== "all" ? (
          <span className="text-[13px] text-black/45 md:hidden">
            {selectedCategory}
          </span>
        ) : null}
      </div>

      {selectedCategory !== "all" ? (
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-medium underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {filteredProducts.length === 0 ? (
        <div className="border-t border-black/[0.06] py-24 text-center">
          <p className="text-[20px] font-medium">No products match</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-6 text-[14px] font-medium underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-14 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-16 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PRODUCTS_PER_PAGE)}
                className="inline-flex bg-black px-10 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}

      {showFilters ? (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilters(false)}
            aria-label="Close"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-[#f7f7f5] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[20px] font-medium">Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6 space-y-8">
              <div>
                <h4 className="mb-3 text-[12px] uppercase tracking-[0.18em] text-black/40">
                  Category
                </h4>
                <div className="flex flex-wrap gap-3">
                  <Chip active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>
                    All
                  </Chip>
                  {categories.map((cat) => (
                    <Chip
                      key={cat}
                      active={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="w-full min-h-12 bg-black py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white"
            >
              Show {filteredProducts.length} products
            </button>
          </div>
        </div>
      ) : null}
    </StorePage>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Loading</p>
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}
