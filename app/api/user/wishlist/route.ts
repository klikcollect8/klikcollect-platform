import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import {
  addWishlist,
  listWishlist,
  removeWishlist,
} from "@/lib/customer-store";

export async function GET() {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();
    return NextResponse.json(await listWishlist(actor.userId));
  } catch (error) {
    console.error("[wishlist GET]", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();

    const { product_id } = await request.json();
    if (!product_id) {
      return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
    }

    const data = await addWishlist(actor.userId, String(product_id));
    return NextResponse.json(data);
  } catch (error) {
    console.error("[wishlist POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson();

    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get("product_id");
    if (!product_id) {
      return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
    }

    await removeWishlist(actor.userId, product_id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[wishlist DELETE]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
