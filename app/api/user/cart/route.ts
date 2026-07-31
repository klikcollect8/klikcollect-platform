import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import {
  deleteCartItem,
  listCart,
  upsertCartItem,
} from "@/lib/customer-store";

export async function GET() {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();
  const data = await listCart(actor.userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = await request.json();
  // Prefer offer_id (vendor offer); fall back to product_id for legacy
  const lineId = String(body.offer_id || body.product_id || "");
  const quantity = body.quantity;
  if (!lineId || !quantity) {
    return NextResponse.json(
      { error: "Missing offer_id/product_id or quantity" },
      { status: 400 },
    );
  }

  const data = await upsertCartItem(
    actor.userId,
    lineId,
    Number(quantity),
  );
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = await request.json();
  const lineId = String(body.offer_id || body.product_id || "");
  const quantity = body.quantity;
  if (!lineId || quantity === undefined) {
    return NextResponse.json(
      { error: "Missing offer_id/product_id or quantity" },
      { status: 400 },
    );
  }

  if (Number(quantity) <= 0) {
    await deleteCartItem(actor.userId, lineId);
    return NextResponse.json({ deleted: true });
  }

  const data = await upsertCartItem(actor.userId, lineId, Number(quantity));
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const { searchParams } = new URL(request.url);
  const product_id = searchParams.get("product_id");
  if (!product_id) {
    return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
  }

  await deleteCartItem(actor.userId, product_id);
  return NextResponse.json({ deleted: true });
}
