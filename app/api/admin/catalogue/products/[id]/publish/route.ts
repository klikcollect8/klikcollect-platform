import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { publishProduct } from "@/lib/catalogue/admin-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const gate = await withCatalogueAuth("products:publish");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = await publishProduct(id, {
      actor: { userId: gate.user.id, email: gate.user.email },
      override: Boolean(body.override),
      reason: typeof body.reason === "string" ? body.reason : undefined,
      asReview: Boolean(body.asReview),
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
