import { NextRequest, NextResponse } from "next/server";
import { isValidGtin, normaliseBarcode } from "@/lib/barcode";
import { findByBarcode, availableOf } from "@/lib/inventory";
import {
  requireVendorActor,
  type VendorActor,
} from "@/lib/auth/require-vendor";
import { setProductBarcode, listCatalogue } from "@/lib/catalogue-store";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";

/**
 * Resolve a barcode/GTIN to a product in the caller's vendor catalogue.
 */
export async function GET(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;
  const code = request.nextUrl.searchParams.get("code") || "";
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  return lookup(code, gate.actor, vendorId);
}

export async function POST(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const code = String(body?.code || "");
  const vendorId = body?.vendorId ? String(body.vendorId) : undefined;

  if (body?.productId && body?.assign) {
    const gtin = normaliseBarcode(code);
    if (!isValidGtin(gtin) && gtin.length < 8) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_GTIN",
            message: "Barcode failed GTIN validation",
          },
        },
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
    if (updated.vendorId && !inVendorScope(gate.actor, updated.vendorId)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Product out of scope" } },
        { status: 403 },
      );
    }
    return NextResponse.json({ data: updated });
  }

  return lookup(code, gate.actor, vendorId);
}

async function lookup(code: string, actor: VendorActor, vendorId?: string) {
  const gtin = normaliseBarcode(code);
  if (!gtin) {
    return NextResponse.json(
      { error: { code: "INVALID", message: "code required" } },
      { status: 400 },
    );
  }

  const scope =
    vendorId && inVendorScope(actor, vendorId)
      ? [vendorId]
      : vendorScopeIds(actor);

  const validGtin = isValidGtin(gtin);
  let product = await findByBarcode(gtin);

  if (product?.vendorId && scope.length && !scope.includes(product.vendorId)) {
    product = null;
  }

  if (!product && scope[0]) {
    const catalogue = await listCatalogue(scope[0]);
    product =
      catalogue.find(
        (p) =>
          (p.barcode && normaliseBarcode(p.barcode) === gtin) ||
          (p.gtin && normaliseBarcode(p.gtin) === gtin) ||
          p.id.replace(/\D/g, "").endsWith(gtin.slice(-6)),
      ) || null;
  }

  if (!product) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: validGtin
            ? "No product for this GTIN in your catalogue"
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
