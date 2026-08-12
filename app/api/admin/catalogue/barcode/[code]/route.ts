import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import { findLocalProductByBarcode } from "@/lib/product-resolver";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await withCatalogueAuth("barcode:scan");
    const { code } = await ctx.params;
    const normalised = normaliseBarcode(decodeURIComponent(code), {
      requireGtin: true,
    });
    if (!normalised.valid) {
      return NextResponse.json(
        { error: normalised.error || "Invalid barcode", barcode: normalised.value },
        { status: 400 },
      );
    }

    const product = await findLocalProductByBarcode(normalised.value);
    if (product) {
      return NextResponse.json({
        found: true,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          gtin: product.gtin,
          status: product.status,
          image: product.image,
          brand: product.brand,
          categoryName: product.categoryName,
        },
      });
    }

    return NextResponse.json({
      found: false,
      message: "No existing product found for this barcode.",
      barcode: normalised.value,
      format: normalised.format,
    });
  } catch (err) {
    return jsonError(err);
  }
}
