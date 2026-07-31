import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import { listCart } from "@/lib/customer-store";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { getOfferById } from "@/lib/offers-store";
import { getProductById } from "@/lib/products-store";
import { resolveProductImage } from "@/lib/product-image";
import type { CartItem } from "@/types";

export async function GET() {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();

    await ensureNairobiSeed();
    const cartData = await listCart(actor.userId);
    if (!cartData.length) return NextResponse.json([]);

    const items: CartItem[] = [];
    for (const item of cartData) {
      // product_id stores offerId for multi-vendor cart lines
      const offer = await getOfferById(item.product_id);
      if (!offer) continue;
      const product = await getProductById(offer.productId);
      if (!product) continue;
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
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("[cart-with-products]", error);
    return NextResponse.json([]);
  }
}
