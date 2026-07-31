'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { resolveProductImage } from '@/lib/product-image';

interface ProductBundlesProps {
  productId: string;
  category: string;
}

export default function ProductBundles({ productId, category }: ProductBundlesProps) {
  const [related, setRelated] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setRelated(
          data
            .filter((p: Product) => p.category === category && p.id !== productId)
            .slice(0, 3),
        );
      })
      .catch(() => setRelated([]));
  }, [productId, category]);

  if (related.length < 2) return null;

  return (
    <div className="mt-12 border-t border-black/[0.06] pt-8">
      <h3 className="mb-4 text-[18px] font-medium tracking-tight">Also shop</h3>
      <div className="flex flex-wrap items-center gap-4">
        {related.map((product, pIdx) => (
          <div key={product.id} className="flex items-center gap-4">
            <Link
              href={`/products/${product.id}`}
              className="relative h-24 w-24 overflow-hidden bg-black/[0.03]"
            >
              <Image
                src={resolveProductImage(product.image)}
                alt={product.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </Link>
            {pIdx < related.length - 1 ? (
              <span className="text-2xl text-black/25">+</span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-black/45">
        Choose a seller on each product page before adding to bag.
      </p>
    </div>
  );
}
