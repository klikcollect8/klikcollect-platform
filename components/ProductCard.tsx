"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { track } from "@/lib/track";

interface ProductCardProps {
  product: Product;
  /** When set (vendor storefront), show this vendor's price */
  offerPrice?: number;
  /** Prefill offer on PDP */
  offerId?: string;
}

export default function ProductCard({
  product,
  offerPrice,
  offerId,
}: ProductCardProps) {
  const href = offerId
    ? `/products/${product.id}?offer=${encodeURIComponent(offerId)}`
    : `/products/${product.id}`;

  return (
    <article className="group flex h-full flex-col">
      <Link
        href={href}
        onClick={() =>
          track("storefront.product_clicked", { productId: product.id }, "customer")
        }
        className="relative mb-5 block aspect-[4/5] overflow-hidden bg-black/[0.03]"
      >
        <Image
          src={resolveProductImage(product.image)}
          alt={product.name || "Product"}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/[0.04]" />
      </Link>

      <p className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-black/35">
        {product.category || "Catalogue"}
      </p>

      <Link
        href={href}
        className="mb-1.5 line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-black transition-opacity hover:opacity-50"
      >
        {product.name}
      </Link>

      {typeof offerPrice === "number" ? (
        <p className="text-[17px] font-medium tabular-nums tracking-tight">
          {formatPrice(offerPrice)}
        </p>
      ) : null}
    </article>
  );
}
