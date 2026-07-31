"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Product, Category } from "@/types";
import ProductCard from "@/components/ProductCard";
import { Filter, X } from "lucide-react";
import Link from "next/link";
import SearchHistory from "@/components/SearchHistory";
import SearchBar from "@/components/SearchBar";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");

  useEffect(() => {
    setLoading(true);
    if (!query) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          setProducts(Array.isArray(data) ? data : []);
          setFilteredCategories([]);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
      return;
    }

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setFilteredCategories(data.categories || []);
        try {
          const history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
          if (!history.includes(query)) {
            localStorage.setItem(
              "searchHistory",
              JSON.stringify([query, ...history.filter((h: string) => h !== query)].slice(0, 10)),
            );
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        setProducts([]);
        setFilteredCategories([]);
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    let filtered = [...products];
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }
    if (minRating > 0) filtered = filtered.filter((p) => (p.rating || 0) >= minRating);

    switch (sortBy) {
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "newest":
      case "price-low":
      case "price-high":
        filtered.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
        break;
    }
    setFilteredProducts(filtered);
  }, [products, minRating, selectedCategories, sortBy]);

  const categoryNames = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const Filters = (
    <div className="space-y-10">
      {categoryNames.length > 0 ? (
        <div>
          <h3 className="mb-4 text-[12px] font-medium uppercase tracking-[0.18em] text-black/40">
            Category
          </h3>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {categoryNames.map((category) => (
              <label key={category} className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCategories([...selectedCategories, category]);
                    } else {
                      setSelectedCategories(selectedCategories.filter((c) => c !== category));
                    }
                  }}
                  className="h-4 w-4 accent-black"
                />
                <span className="text-[14px] text-black/70">{category}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-4 text-[12px] font-medium uppercase tracking-[0.18em] text-black/40">
          Rating
        </h3>
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setMinRating(minRating === rating ? 0 : rating)}
              className={`border px-3 py-1.5 text-[13px] transition-colors ${
                minRating === rating
                  ? "border-black bg-black text-white"
                  : "border-black/12 text-black/60 hover:border-black/30"
              }`}
            >
              {rating}+
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <StorePage>
      <StoreHeading
        eyebrow="Search"
        title={query ? `"${query}"` : "Browse all"}
        description={`${filteredProducts.length} ${filteredProducts.length === 1 ? "result" : "results"}`}
        action={
          <div className="w-full max-w-md sm:w-80">
            <SearchBar placeholder="Search products" defaultValue={query} size="md" />
          </div>
        }
      />

      {!query ? (
        <div className="mb-12">
          <SearchHistory />
        </div>
      ) : null}

      <div className="flex gap-12 lg:gap-16">
        <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
          <div className="sticky top-28 border-t border-black/[0.06] pt-8">{Filters}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 border border-black/12 px-4 py-2.5 text-[13px] font-medium lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="ml-auto border border-black/12 bg-transparent px-4 py-2.5 text-[13px] focus:border-black/40 focus:outline-none"
            >
              <option value="relevance">Featured</option>
              <option value="newest">Newest</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          {query && filteredCategories.length > 0 ? (
            <div className="mb-14">
              <h2 className="mb-6 text-[18px] font-medium tracking-tight">Categories</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {filteredCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/shop?category=${encodeURIComponent(category.name)}`}
                    className="text-[15px] font-medium underline-offset-4 hover:underline"
                  >
                    {category.name}
                    {category.productCount != null ? (
                      <span className="ml-1.5 text-black/40">({category.productCount})</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse bg-black/[0.04]" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="border-t border-black/[0.06] py-20 text-center">
              <p className="text-[18px] font-medium">No results</p>
              <p className="mt-2 text-[15px] text-black/50">Try a different search or clear filters.</p>
              <Link
                href="/shop"
                className="mt-8 inline-flex text-[14px] font-medium underline underline-offset-4"
              >
                Browse catalogue →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showFilters ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilters(false)}
            aria-label="Close"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-[#f7f7f5] px-6 py-8">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-[20px] font-medium">Filters</h3>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {Filters}
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="mt-10 w-full bg-black py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white"
            >
              Show {filteredProducts.length} results
            </button>
          </div>
        </div>
      ) : null}
    </StorePage>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Loading</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
