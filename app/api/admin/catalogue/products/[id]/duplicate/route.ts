import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { duplicateProduct } from "@/lib/catalogue/admin-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const gate = await withCatalogueAuth("products:create");
    const { id } = await ctx.params;
    const product = await duplicateProduct(id, {
      userId: gate.user.id,
      email: gate.user.email,
    });
    return NextResponse.json({ product });
  } catch (err) {
    return jsonError(err);
  }
}
