import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { normalizeDigits } from "@/lib/catalogue/gtin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await withCatalogueAuth("barcode:scan");
    const { code } = await ctx.params;
    const digits = normalizeDigits(decodeURIComponent(code));
    if (!digits) {
      return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
    }

    const sb = getServiceSupabase();
    const { data: product } = await sb
      .from("products")
      .select("public_id, name, sku, barcode, gtin, status, image_url")
      .or(`barcode.eq.${digits},gtin.eq.${digits}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (product) {
      return NextResponse.json({
        found: true,
        product: {
          id: product.public_id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          gtin: product.gtin,
          status: product.status,
          image: product.image_url,
        },
      });
    }

    const { data: variant } = await sb
      .from("product_variants")
      .select("public_id, title, product_public_id, barcode, sku")
      .eq("barcode", digits)
      .is("deleted_at", null)
      .maybeSingle();

    if (variant) {
      return NextResponse.json({
        found: true,
        variant: {
          id: variant.public_id,
          title: variant.title,
          productId: variant.product_public_id,
          barcode: variant.barcode,
          sku: variant.sku,
        },
      });
    }

    return NextResponse.json({
      found: false,
      message: "No existing product found for this barcode.",
      barcode: digits,
    });
  } catch (err) {
    return jsonError(err);
  }
}
