import { NextRequest, NextResponse } from "next/server";
import { isValidGtin, normaliseBarcode } from "@/lib/barcode";
import { findByBarcode } from "@/lib/inventory";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { availableOf } from "@/lib/inventory";
import { setProductBarcode, listCatalogue } from "@/lib/catalogue-store";

/**
 * Resolve a barcode/GTIN to a catalogue product (M2).
 * GET ?code=...  or POST { code }
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") || "";
  return lookup(code);
}

export async function POST(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const code = String(body?.code || "");

  // Optional: assign barcode to product
  if (body?.productId && body?.assign) {
    const gtin = normaliseBarcode(code);
    if (!isValidGtin(gtin) && gtin.length < 8) {
      return NextResponse.json(
        { error: { code: "INVALID_GTIN", message: "Barcode failed GTIN validation" } },
        { status: 400 },
      );
    }
    const updated = await setProductBarcode(String(body.productId), gtin);
    if (!updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: updated });
  }

  return lookup(code);
}

async function lookup(code: string) {
  const gtin = normaliseBarcode(code);
  if (!gtin) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "code required" } },
      { status: 400 },
    );
  }

  const validGtin = isValidGtin(gtin);
  let product = await findByBarcode(gtin);

  // Dev convenience: if no barcode on catalogue yet, match trailing digits of id
  if (!product) {
    const all = await listCatalogue();
    product =
      all.find((p) => p.id.replace(/\D/g, "").endsWith(gtin.slice(-6))) || null;
  }

  if (!product) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: validGtin
            ? "No product for this GTIN"
            : "Invalid GTIN and no local match",
        },
        meta: { gtin, validGtin },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...product,
      available: availableOf(product),
    },
    meta: { gtin, validGtin },
  });
}
