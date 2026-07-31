"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

export default function TodaysDealsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        const deals = (Array.isArray(data) ? data : []).slice(0, 20);
        setProducts(deals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <StorePage>
      <StoreHeading
        eyebrow="Picks"
        title="Today's deals"
        description="Selected finds worth a look"
        action={
          <div className="w-full max-w-md sm:w-80">
            <SearchBar placeholder="Search products" size="md" />
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse bg-black/[0.04]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="border-t border-black/[0.06] py-20 text-center text-black/50">
          No deals right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </StorePage>
  );
}
