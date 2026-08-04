"use client";

import { useMemo } from "react";
import type { CartItem } from "@/types";
import { resolveProductImage } from "@/lib/product-image";
import { formatPrice } from "@/lib/currency";
import PromoCarousel, {
  type PromoSlide,
} from "@/components/marketplace/PromoCarousel";

function linePrice(item: CartItem) {
  return item.offerPrice ?? item.product.price ?? 0;
}

function slidesFromBag(items: CartItem[]): PromoSlide[] {
  return items
    .filter((item) => item.product)
    .map((item) => {
      const qty = item.quantity;
      return {
        id: `bag_${item.offerId || item.product.id}`,
        eyebrow: "In your bag",
        title: item.product.name,
        href: `/products/${item.product.id}${
          item.offerId ? `?offer=${encodeURIComponent(item.offerId)}` : ""
        }`,
        image: resolveProductImage(item.product.image),
        meta: `${qty} × ${formatPrice(linePrice(item))}`,
      };
    });
}

/** Cart carousel - only products currently in the bag */
export default function CartPromotions({ items }: { items: CartItem[] }) {
  const slides = useMemo(() => slidesFromBag(items), [items]);
  return <PromoCarousel slides={slides} />;
}
