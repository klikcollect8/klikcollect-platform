"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { resolveProductImage } from "@/lib/product-image";

interface RelatedProductsProps {
  currentProductId: string;
  category: string;
}

export default function RelatedProducts({
  currentProductId,
  category,
}: RelatedProductsProps) {
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setRelatedProducts(
          data
            .filter(
              (p: Product) =>
                p.id !== currentProductId && p.category === category,
            )
            .slice(0, 8),
        );
      })
      .catch(() => setRelatedProducts([]));
  }, [currentProductId, category]);

  if (relatedProducts.length === 0) return null;

  return (
    <section className="w-full">
      <div className="mb-10 flex items-end justify-between gap-6">
        <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight">
          More in {category}
        </h2>
        <Link
          href={`/shop?category=${encodeURIComponent(category)}`}
          className="shrink-0 text-[14px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
        >
          Shop all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:gap-x-8 xl:gap-y-12">
        {relatedProducts.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group min-w-0"
          >
            <div className="relative aspect-square overflow-hidden bg-black/[0.02]">
              <Image
                src={resolveProductImage(product.image)}
                alt={product.name || "Product"}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                sizes="240px"
              />
            </div>
            <h3 className="mt-3 truncate text-[14px] font-medium tracking-tight">
              {product.name}
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-black/40">
              {product.category}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
