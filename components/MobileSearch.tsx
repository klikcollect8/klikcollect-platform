"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Search, ArrowRight } from "lucide-react";
import { Product } from "@/types";
import { resolveProductImage } from "@/lib/product-image";
import { V1_CATEGORIES } from "@/lib/curation-policy";

interface MobileSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR = ["Olive oil", "Milk", "Sourdough", "Avocado", "Coffee", "Honey"];

export default function MobileSearch({ isOpen, onClose }: MobileSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const catalogueRef = useRef<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("recent_searches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const prefetchCatalogue = useCallback(async () => {
    if (catalogueRef.current) return;
    try {
      const data = await fetch("/api/products").then((r) => r.json());
      catalogueRef.current = Array.isArray(data) ? data : [];
    } catch {
      catalogueRef.current = [];
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setQuery("");
        setProducts([]);
        setLoading(false);
      }, 280);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }

    void prefetchCatalogue();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
        setTimeout(() => inputRef.current?.focus(), 60);
      });
    });
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [isOpen, prefetchCatalogue]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const run = async () => {
      if (!catalogueRef.current) await prefetchCatalogue();
      if (cancelled) return;

      const list = catalogueRef.current || [];
      const filtered = list
        .filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q),
        )
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts - bStarts;
        })
        .slice(0, 15);

      setProducts(filtered);
      setLoading(false);
    };

    const timer = setTimeout(run, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, prefetchCatalogue]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  const remember = (term: string) => {
    const next = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem("recent_searches", JSON.stringify(next));
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = query.trim();
    if (!term) return;
    remember(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    handleClose();
  };

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const hasQuery = query.trim().length > 0;
  const matchingCategories = hasQuery
    ? V1_CATEGORIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase())).slice(
        0,
        3,
      )
    : [];

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        {/* Top */}
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Search
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="group inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close search"
          >
            <span className="hidden sm:inline">Esc</span>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        {/* Search field */}
        <form
          onSubmit={handleSearch}
          className={`mt-6 shrink-0 transition-all duration-500 ease-out sm:mt-8 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <label className="sr-only" htmlFor="kc-search-input">
            Search products
          </label>
          <div className="group relative flex items-center border-b border-black/15 transition-colors focus-within:border-black/50">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/30 transition-colors group-focus-within:text-black/55"
              strokeWidth={1.5}
            />
            <input
              id="kc-search-input"
              ref={inputRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or categories"
              className="w-full bg-transparent py-4 pl-8 pr-24 text-[clamp(1.25rem,2.8vw,1.75rem)] font-medium tracking-tight text-black placeholder:font-normal placeholder:text-black/30 outline-none sm:py-5 sm:pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 text-[12px] text-black/40 transition-colors hover:text-black"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!hasQuery}
                className="ml-1 inline-flex h-9 items-center gap-1.5 bg-black px-3.5 text-[12px] font-medium text-white transition-opacity disabled:cursor-default disabled:opacity-20"
              >
                Go
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-black/35">
            {hasQuery
              ? loading
                ? "Looking…"
                : `${products.length} result${products.length === 1 ? "" : "s"}`
              : "Type to find groceries, pantry, and more"}
          </p>
        </form>

        {/* Body */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto pb-16 pt-10 scrollbar-hide transition-all duration-500 ease-out sm:pt-12 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {hasQuery ? (
            <div className="space-y-12">
              {matchingCategories.length > 0 ? (
                <section>
                  <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    Categories
                  </h2>
                  <div className="flex flex-col gap-1">
                    {matchingCategories.map((cat) => (
                      <Link
                        key={cat}
                        href={`/shop?category=${encodeURIComponent(cat)}`}
                        onClick={handleClose}
                        className="flex items-center justify-between border-b border-black/[0.06] py-3.5 text-[15px] font-medium tracking-tight text-black/80 transition-opacity hover:opacity-50"
                      >
                        {cat}
                        <ArrowRight className="h-4 w-4 text-black/25" strokeWidth={1.5} />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-6 flex items-end justify-between gap-4">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    Products
                  </h2>
                  {!loading && products.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSearch()}
                      className="text-[13px] text-black/50 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
                    >
                      See all
                    </button>
                  ) : null}
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-black/[0.04]" />
                        <div className="mt-3 h-3 w-3/4 bg-black/[0.04]" />
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:gap-x-7 xl:gap-y-12">
                    {products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.id}`}
                        onClick={() => {
                          remember(query.trim());
                          handleClose();
                        }}
                        className="group min-w-0"
                      >
                        <div className="relative aspect-square overflow-hidden bg-black/[0.03]">
                          {product.image ? (
                            <Image
                              src={resolveProductImage(product.image)}
                              alt={product.name}
                              fill
                              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                              sizes="240px"
                            />
                          ) : null}
                        </div>
                        <p className="mt-3 truncate text-[14px] font-medium tracking-tight">
                          {product.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-black/40">
                          {product.category}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-20">
                    <p className="text-[16px] font-medium tracking-tight text-black">
                      No matches
                    </p>
                    <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-black/45">
                      Try a broader term, or browse a category below.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                      {V1_CATEGORIES.slice(0, 5).map((cat) => (
                        <Link
                          key={cat}
                          href={`/shop?category=${encodeURIComponent(cat)}`}
                          onClick={handleClose}
                          className="text-[14px] text-black/55 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black/40"
                        >
                          {cat}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="grid gap-14 sm:grid-cols-2 sm:gap-16 lg:gap-24">
              <section>
                <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  {recentSearches.length ? "Recent" : "Popular"}
                </h2>
                <ul>
                  {(recentSearches.length ? recentSearches : POPULAR).map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => setQuery(term)}
                        className="flex w-full items-center justify-between border-b border-black/[0.06] py-3.5 text-left transition-opacity hover:opacity-45"
                      >
                        <span className="text-[16px] font-medium tracking-tight text-black">
                          {term}
                        </span>
                        <ArrowRight className="h-4 w-4 text-black/20" strokeWidth={1.5} />
                      </button>
                    </li>
                  ))}
                </ul>
                {recentSearches.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("recent_searches");
                    }}
                    className="mt-4 text-[12px] text-black/35 hover:text-black"
                  >
                    Clear recent
                  </button>
                ) : null}
              </section>

              <section>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    Browse
                  </h2>
                  <Link
                    href="/categories"
                    onClick={handleClose}
                    className="text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black"
                  >
                    All
                  </Link>
                </div>
                <ul>
                  {V1_CATEGORIES.map((cat) => (
                    <li key={cat}>
                      <Link
                        href={`/shop?category=${encodeURIComponent(cat)}`}
                        onClick={handleClose}
                        className="flex w-full items-center justify-between border-b border-black/[0.06] py-3.5 transition-opacity hover:opacity-45"
                      >
                        <span className="text-[15px] tracking-tight text-black/75">{cat}</span>
                        <ArrowRight className="h-4 w-4 text-black/20" strokeWidth={1.5} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
