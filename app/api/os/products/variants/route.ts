import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope } from "@/lib/auth/vendor-scope";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { getCatalogueProduct } from "@/lib/catalogue-store";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId") || undefined;
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("products:view", { vendorId });
  if (!gate.ok) return gate.response;

  const sb = getServiceSupabase();
  let q = sb
    .from("product_variants")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (productId) q = q.eq("product_public_id", productId);
  if (vendorId) {
    if (!inVendorScope(gate.actor, vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    q = q.eq("vendor_public_id", vendorId);
  } else {
    q = q.in("vendor_public_id", gate.actor.vendorIds);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const productId = String(body?.productId || "");
  const gate = await requireVendorPermission("products:edit");
  if (!gate.ok) return gate.response;

  const product = await getCatalogueProduct(productId);
  if (!product) {
    return NextResponse.json(
      { error: { message: "Product not found" } },
      { status: 404 },
    );
  }
  const vendorId = product.vendorId || gate.actor.vendorIds[0];
  if (!vendorId || !inVendorScope(gate.actor, vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const variants = Array.isArray(body?.variants) ? body.variants : [];
  const sb = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: offer } = await sb
    .from("product_offers")
    .select("product_id, vendor_id")
    .eq("public_id", productId)
    .maybeSingle();
  if (!offer?.product_id || !offer?.vendor_id) {
    return NextResponse.json(
      { error: { message: "Catalogue offer not found in database" } },
      { status: 404 },
    );
  }

  // Soft-delete existing, then insert new set (simple replace).
  await sb
    .from("product_variants")
    .update({ deleted_at: now, updated_at: now })
    .eq("product_public_id", productId)
    .eq("vendor_public_id", vendorId)
    .is("deleted_at", null);

  if (!variants.length) {
    return NextResponse.json({ data: [] });
  }

  const rows = variants.map(
    (v: {
      title?: string;
      sku?: string;
      barcode?: string;
      options?: Record<string, string>;
      priceMinor?: number;
      salePriceMinor?: number;
      compareAtMinor?: number;
      wholesalePriceMinor?: number;
      onHand?: number;
      vatClass?: string;
    }) => ({
      public_id: publicId("var"),
      product_id: offer.product_id,
      vendor_id: offer.vendor_id,
      product_public_id: productId,
      vendor_public_id: vendorId,
      title: String(v.title || "Default"),
      sku: v.sku ? String(v.sku) : null,
      barcode: v.barcode ? String(v.barcode) : null,
      options: v.options || {},
      price_minor: Math.round(Number(v.priceMinor || 0)),
      sale_price_minor:
        v.salePriceMinor != null ? Math.round(Number(v.salePriceMinor)) : null,
      compare_at_minor:
        v.compareAtMinor != null ? Math.round(Number(v.compareAtMinor)) : null,
      wholesale_price_minor:
        v.wholesalePriceMinor != null
          ? Math.round(Number(v.wholesalePriceMinor))
          : null,
      on_hand: Math.max(0, Math.round(Number(v.onHand || 0))),
      reserved: 0,
      vat_class: v.vatClass || "standard",
      currency_code: "KES",
      updated_at: now,
    }),
  );

  const { data, error } = await sb
    .from("product_variants")
    .insert(rows)
    .select("*");
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}
