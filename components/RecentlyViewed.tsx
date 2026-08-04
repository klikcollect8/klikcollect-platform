"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import Link from "next/link";
import Image from "next/image";

export default function RecentlyViewed({
  section,
}: {
  section?: { title?: string; subtitle?: string; productIds?: string[] };
}) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (section?.productIds && section.productIds.length > 0) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          const selectedProducts = data.filter((p: Product) =>
            section.productIds!.includes(p.id),
          );
          setProducts(selectedProducts);
        });
    } else {
      const recent = localStorage.getItem("recentlyViewed");
      if (recent) {
        setProducts(JSON.parse(recent).slice(0, 4));
      } else {
        // Fallback to fetch random products if no history (for demo purposes)
        fetch("/api/products")
          .then((res) => res.json())
          .then((data) => {
            // Random shuffle
            const shuffled = Array.isArray(data)
              ? data.sort(() => 0.5 - Math.random()).slice(0, 4)
              : [];
            setProducts(shuffled);
          });
      }
    }
  }, [section?.productIds]);

  if (products.length === 0) return null;

  return (
    <div className="py-16 sm:py-24 border-t border-gray-100">
      <div className="mb-10">
        <h2 className="text-2xl sm:text-3xl font-light text-gray-900 mb-2 tracking-tight">
          {section?.title || "Recently Viewed"}
        </h2>
        <p className="text-gray-500 font-medium tracking-wide text-xs uppercase">
          {section?.subtitle || "Pick up where you left off"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group block"
          >
            <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden mb-4 relative">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-110 p-6"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 line-clamp-1 mb-1 group-hover:text-gray-600 transition-colors">
                {product.name}
              </h3>
              <p className="text-xs uppercase tracking-widest text-gray-400">
                {product.category}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
