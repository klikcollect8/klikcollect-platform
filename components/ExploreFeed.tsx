"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const PRODUCTS_PER_PAGE = 8;

export default function ExploreFeed() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        // Randomize for "Explore" feel
        const shuffled = arr.sort(() => 0.5 - Math.random());
        setAllProducts(shuffled);
        setDisplayedProducts(shuffled.slice(0, PRODUCTS_PER_PAGE));
      })
      .catch(() => setDisplayedProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);

    // Artificial delay for smooth UX and stable layout shifts
    setTimeout(() => {
      setPage((prevPage) => {
        const nextPage = prevPage + 1;
        const nextProducts = allProducts.slice(0, nextPage * PRODUCTS_PER_PAGE);
        setDisplayedProducts(nextProducts);
        return nextPage;
      });
      setLoadingMore(false);
    }, 800);
  }, [allProducts, loadingMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          displayedProducts.length < allProducts.length &&
          !loading &&
          !loadingMore
        ) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, displayedProducts.length, allProducts.length, loading, loadingMore]);

  if (loading)
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  if (displayedProducts.length === 0) return null;

  return (
    <div className="py-8 md:py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6 px-4 md:px-0">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3 block">
            Discover
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-light text-black tracking-tighter">
            Explore Products
          </h2>
        </div>
        <Link
          href="/shop"
          className="hidden md:flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-black border-b border-black pb-1 hover:opacity-60 transition-opacity"
        >
          View Full Catalog
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12 px-4 md:px-0">
        {displayedProducts.map((product) => (
          <div key={product.id} className="w-full">
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Infinite Scroll Loader / Trigger */}
      {displayedProducts.length < allProducts.length && (
        <div
          ref={observerTarget}
          className="h-24 w-full flex justify-center items-center mt-8"
        >
          {loadingMore && (
             <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
          )}
        </div>
      )}

      {/* End of Feed */}
      {displayedProducts.length >= allProducts.length && (
        <div className="mt-16 flex justify-center px-4">
          <Link
            href="/shop"
            className="w-full md:w-auto text-center px-10 py-4 bg-white border border-neutral-200 text-black text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300"
          >
            View Full Catalog
          </Link>
        </div>
      )}
    </div>
  );
}
