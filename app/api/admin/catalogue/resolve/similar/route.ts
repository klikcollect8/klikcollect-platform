import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { findSimilarProducts } from "@/lib/product-resolver/resolve";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("barcode:scan");
    const url = new URL(req.url);
    const barcode = (url.searchParams.get("barcode") || "").trim();
    const brand = url.searchParams.get("brand");
    const terms = url.searchParams.get("q");
    if (!barcode) {
      return NextResponse.json({ error: "barcode is required" }, { status: 400 });
    }
    const similar = await findSimilarProducts({
      seedBarcode: barcode,
      brand,
      searchTerms: terms || brand,
    });
    return NextResponse.json({ barcode, similar });
  } catch (err) {
    return jsonError(err);
  }
}
