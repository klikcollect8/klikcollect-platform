import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { commitResolvedProduct } from "@/lib/product-resolver";
import type { ResolveCommitInput } from "@/lib/product-resolver/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await withCatalogueAuth("products:create");
    const body = (await req.json()) as ResolveCommitInput;
    const result = await commitResolvedProduct(body, {
      userId: user.id,
      email: user.email || null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          duplicate: result.duplicate,
          productId: result.duplicate ? result.productId : undefined,
        },
        { status: result.duplicate ? 409 : 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      productId: result.productId,
      created: result.created,
      message: "Product successfully added to KlikCollect.",
    });
  } catch (err) {
    return jsonError(err);
  }
}
