import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { findDuplicateProducts } from "@/lib/catalogue/duplicate-detect";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const body = await req.json();
    const matches = await findDuplicateProducts({
      name: body.name,
      sku: body.sku,
      barcode: body.barcode,
      gtin: body.gtin,
      mpn: body.mpn,
      brandName: body.brandName,
      excludePublicId: body.excludePublicId,
    });
    return NextResponse.json({ matches });
  } catch (err) {
    return jsonError(err);
  }
}
