import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import { listCart } from "@/lib/customer-store";
import { getOfferById } from "@/lib/offers-store";
import { getProductById } from "@/lib/products-store";
import { resolveProductImage } from "@/lib/product-image";
import type { CartItem, FulfilmentMethod } from "@/types";

export async function GET() {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();

    const cartData = await listCart(actor.userId);
    if (!cartData.length) return NextResponse.json([]);

    const items: CartItem[] = [];
    const seen = new Set<string>();
    for (const item of cartData) {
      // Prefer offer_id; legacy rows stored offer id in product_id.
      const offerKey = item.offer_id || item.product_id;
      if (!offerKey || seen.has(offerKey)) continue;
      const offer = await getOfferById(offerKey);
      if (!offer) continue;
      const product = await getProductById(offer.productId);
      if (!product) continue;
      seen.add(offer.id);
      const fulfilment: FulfilmentMethod | undefined =
        item.fulfilment === "delivery" || item.fulfilment === "pickup"
          ? item.fulfilment
          : undefined;
      items.push({
        product: {
          ...product,
          image: resolveProductImage(product.image),
          price: offer.price,
          stock: offer.stock,
          vendorName: offer.vendorName,
          neighbourhood: offer.neighbourhood,
        },
        quantity: item.quantity,
        offerId: offer.id,
        offerPrice: offer.price,
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        neighbourhood: offer.neighbourhood,
        fulfilment,
        deliveryZoneId: item.delivery_zone_id,
        deliveryZoneLabel: item.delivery_zone_label,
        deliveryFee: item.delivery_fee,
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("[cart-with-products]", error);
    return NextResponse.json([]);
  }
}
