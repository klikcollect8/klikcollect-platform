import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import {
  clearCart,
  deleteCartItem,
  listCart,
  upsertCartItem,
  type CartFulfilmentFields,
} from "@/lib/customer-store";
import { getOfferById } from "@/lib/offers-store";

function parseFulfilmentMeta(body: Record<string, unknown>): CartFulfilmentFields {
  const fulfilmentRaw = body.fulfilment;
  const fulfilment =
    fulfilmentRaw === "delivery" || fulfilmentRaw === "pickup"
      ? fulfilmentRaw
      : undefined;
  return {
    fulfilment,
    deliveryZoneId:
      body.delivery_zone_id != null
        ? String(body.delivery_zone_id)
        : undefined,
    deliveryZoneLabel:
      body.delivery_zone_label != null
        ? String(body.delivery_zone_label)
        : undefined,
    deliveryFee:
      body.delivery_fee != null && Number.isFinite(Number(body.delivery_fee))
        ? Number(body.delivery_fee)
        : undefined,
  };
}

async function validateAndCapQuantity(
  offerId: string | undefined,
  quantity: number,
): Promise<{ ok: true; quantity: number } | { ok: false; error: string }> {
  if (!offerId) return { ok: true, quantity };
  const offer = await getOfferById(offerId);
  if (!offer) {
    return { ok: false, error: "Offer not found" };
  }
  const stock = Number(offer.stock);
  if (Number.isFinite(stock)) {
    const capped = Math.max(0, Math.min(Number(quantity), stock));
    if (capped <= 0) {
      return { ok: false, error: "Out of stock" };
    }
    return { ok: true, quantity: capped };
  }
  return { ok: true, quantity: Number(quantity) };
}

export async function GET() {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();
  const data = await listCart(actor.userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = (await request.json()) as Record<string, unknown>;
  const offerId = body.offer_id ? String(body.offer_id) : undefined;
  const productId = String(body.product_id || body.offer_id || "");
  const quantity = body.quantity;
  if (!productId || !quantity) {
    return NextResponse.json(
      { error: "Missing offer_id/product_id or quantity" },
      { status: 400 },
    );
  }

  const validated = await validateAndCapQuantity(offerId, Number(quantity));
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const data = await upsertCartItem(
    actor.userId,
    productId,
    validated.quantity,
    offerId,
    parseFulfilmentMeta(body),
  );
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = (await request.json()) as Record<string, unknown>;
  const offerId = body.offer_id ? String(body.offer_id) : undefined;
  const productId = String(body.product_id || body.offer_id || "");
  const quantity = body.quantity;
  if (!productId || quantity === undefined) {
    return NextResponse.json(
      { error: "Missing offer_id/product_id or quantity" },
      { status: 400 },
    );
  }

  if (Number(quantity) <= 0) {
    await deleteCartItem(actor.userId, offerId || productId);
    return NextResponse.json({ deleted: true });
  }

  const validated = await validateAndCapQuantity(offerId, Number(quantity));
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const data = await upsertCartItem(
    actor.userId,
    productId,
    validated.quantity,
    offerId,
    parseFulfilmentMeta(body),
  );
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const { searchParams } = new URL(request.url);
  const product_id = searchParams.get("product_id");
  if (!product_id) {
    await clearCart(actor.userId);
    return NextResponse.json({ cleared: true });
  }

  await deleteCartItem(actor.userId, product_id);
  return NextResponse.json({ deleted: true });
}
