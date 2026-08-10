import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  archiveProduct,
  getAdminProductDetail,
} from "@/lib/catalogue/admin-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await withCatalogueAuth("products:view");
    const { id } = await ctx.params;
    const product = await getAdminProductDetail(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const gate = await withCatalogueAuth("products:archive");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const product = await archiveProduct(
      id,
      { userId: gate.user.id, email: gate.user.email },
      typeof body.reason === "string" ? body.reason : undefined,
    );
    return NextResponse.json({ product });
  } catch (err) {
    return jsonError(err);
  }
}
