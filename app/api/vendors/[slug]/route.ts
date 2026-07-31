import { NextRequest, NextResponse } from "next/server";
import {
  getAdmittedVendorBySlug,
  getVendorProducts,
} from "@/lib/admitted-vendors";

/** Public vendor storefront payload — admitted vendors only */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const vendor = await getAdmittedVendorBySlug(slug);
    if (!vendor) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vendor not found" } },
        { status: 404 },
      );
    }
    const products = await getVendorProducts(vendor);
    return NextResponse.json({ data: { vendor, products } });
  } catch (error) {
    console.error("GET /api/vendors/[slug]", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load vendor" } },
      { status: 500 },
    );
  }
}
