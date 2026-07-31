"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import ObscuraHome from "@/components/obscura/ObscuraHome";
import { track } from "@/lib/track";

function HomePageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "default";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track("storefront.home_viewed", { market: "Nairobi" }, "customer");
    const controller = new AbortController();
    fetch("/api/products", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (category !== "all" || sort !== "default") {
      track("storefront.browse_filtered", { category, sort }, "customer");
    }
  }, [category, sort]);

  const filtered = useMemo(() => {
    let list = products;
    if (category !== "all") {
      list = list.filter((p) => p?.category?.toLowerCase() === category.toLowerCase());
    }
    if (sort === "rating")
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === "newest" || sort === "price-low" || sort === "price-high")
      list = [...list].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    return list;
  }, [products, category, sort]);

  if (category !== "all" || sort !== "default") {
    return (
      <div className="min-h-screen bg-[#f7f7f5] pb-16 pt-6">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Catalogue</p>
            <h1
              className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-medium capitalize tracking-tight"
              style={{ fontFamily: "var(--font-display), var(--font-montreal), sans-serif" }}
            >
              {category !== "all" ? category.replace(/-/g, " ") : "All products"}
            </h1>
            <p className="mt-2 text-[14px] text-black/55">
              {filtered.length} results · groceries · KES
            </p>
            <div className="mt-4 max-w-md">
              <SearchBar placeholder="Search within results..." />
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-black/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-black/10 px-6 py-16 text-center">
              <p className="text-black/55">No products match.</p>
              <Link href="/" className="mt-3 inline-block underline underline-offset-4">
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

  if (loading && !products.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Connecting</p>
      </div>
    );
  }

  return <ObscuraHome products={products} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Connecting</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
