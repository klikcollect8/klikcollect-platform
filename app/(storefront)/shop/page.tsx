"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import { ListFilter, Search } from "lucide-react";
import { track } from "@/lib/track";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";
import ThemeSelect from "@/components/ui/ThemeSelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRODUCTS_PER_PAGE = 24;

function ShopInner() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category") || "all";

  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);

  const selectedCategory = categoryOverride ?? urlCategory;
  const setSelectedCategory = (value: string) => setCategoryOverride(value);

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
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }
      const q = query.trim().toLowerCase();
      if (q) {
        return (
          p.name?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
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
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
    }
    return result;
  }, [products, selectedCategory, sortBy, query]);

  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [filteredProducts.length, selectedCategory, query]);

  const clearAll = () => {
    setSelectedCategory("all");
    setQuery("");
  };

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;
  const isFiltering = Boolean(query.trim()) || selectedCategory !== "all";

  if (loading) {
    return (
      <StorePage>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse bg-black/[0.04]"
            />
          ))}
        </div>
      </StorePage>
    );
  }

  return (
    <StorePage className="pb-24">
      <StoreHeading
        eyebrow="Shop"
        title={selectedCategory !== "all" ? selectedCategory : "Shop"}
        description={`${filteredProducts.length} items`}
        action={
          <ThemeSelect
            value={sortBy}
            onValueChange={setSortBy}
            options={[
              { value: "newest", label: "Newest" },
              { value: "rating", label: "Top rated" },
              { value: "name", label: "Name A-Z" },
            ]}
          />
        }
      />

      {/* Mobile: full-width search + filter icon */}
      <div className="mb-5 flex items-stretch gap-2 sm:hidden">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="box-border h-12 w-full border border-black/12 bg-transparent py-0 pl-10 pr-3 text-[16px] leading-none focus:border-black/40 focus:outline-none"
          />
        </div>
        {categories.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Filter by category"
              className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center border border-black/12 text-black/55 transition-colors hover:border-black/30 hover:text-black ${
                selectedCategory !== "all" ? "border-black/40 text-black" : ""
              }`}
            >
              <ListFilter className="h-4 w-4" />
              {selectedCategory !== "all" ? (
                <span
                  className="absolute right-2.5 top-2.5 h-1.5 w-1.5 bg-black"
                  aria-hidden
                />
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuRadioGroup
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <DropdownMenuRadioItem value="all">
                  All categories
                </DropdownMenuRadioItem>
                {categories.map((cat) => (
                  <DropdownMenuRadioItem key={cat} value={cat}>
                    {cat}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Desktop / tablet: search + category select */}
      <div
        className={`mb-8 hidden items-stretch gap-3 sm:mb-10 sm:grid ${
          categories.length > 0
            ? "sm:grid-cols-[minmax(0,1fr)_13rem]"
            : "sm:grid-cols-1"
        }`}
      >
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="box-border h-11 w-full border border-black/12 bg-transparent py-0 pl-11 pr-4 text-[14px] leading-none focus:border-black/40 focus:outline-none"
          />
        </div>
        {categories.length > 0 ? (
          <ThemeSelect
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            size="sm"
            fullWidth
            placeholder="All"
            triggerClassName="box-border h-11 w-full min-w-0 px-4 text-[14px] leading-none"
            className="min-w-[12rem]"
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((cat) => ({
                value: cat,
                label: cat,
              })),
            ]}
          />
        ) : null}
      </div>

      {isFiltering ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8">
          <p className="text-[12px] text-black/40">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "result" : "results"}
            {selectedCategory !== "all" ? ` · ${selectedCategory}` : ""}
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-medium underline underline-offset-4"
          >
            Clear
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-14 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8">
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
    </StorePage>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
            Loading
          </p>
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}
