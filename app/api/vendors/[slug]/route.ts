import { NextRequest, NextResponse } from "next/server";
import { getVendorStorefrontBundle } from "@/lib/vendor-storefront";

/** Public vendor storefront payload - admitted vendors only */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const bundle = await getVendorStorefrontBundle(slug);
    if (!bundle) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vendor not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: bundle });
  } catch (error) {
    console.error("GET /api/vendors/[slug]", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load vendor" } },
      { status: 500 },
    );
  }
}
