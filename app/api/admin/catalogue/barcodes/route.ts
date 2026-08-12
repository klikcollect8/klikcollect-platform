import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  getBarcodeHistory,
  listBarcodeManagement,
  updateProductBarcodes,
} from "@/lib/catalogue/barcode-management";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (productId) {
      const history = await getBarcodeHistory(productId);
      return NextResponse.json(history);
    }
    const items = await listBarcodeManagement({
      q: url.searchParams.get("q") || undefined,
      missingOnly: url.searchParams.get("missing") === "1",
      limit: Number(url.searchParams.get("limit") || 40),
    });
    return NextResponse.json({ items });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await withCatalogueAuth("barcode:assign");
    const body = (await req.json()) as {
      productPublicId?: string;
      barcode?: string | null;
      gtin?: string | null;
      additionalBarcodes?: string[];
      reason?: string;
      allowInvalid?: boolean;
    };
    if (!body.productPublicId) {
      return NextResponse.json(
        { error: "productPublicId required" },
        { status: 400 },
      );
    }
    const updated = await updateProductBarcodes({
      productPublicId: body.productPublicId,
      barcode: body.barcode,
      gtin: body.gtin,
      additionalBarcodes: body.additionalBarcodes,
      reason: body.reason,
      allowInvalid: body.allowInvalid,
      actor: { userId: user.id, email: user.email || null },
    });
    return NextResponse.json({ ok: true, product: updated });
  } catch (err) {
    return jsonError(err);
  }
}
