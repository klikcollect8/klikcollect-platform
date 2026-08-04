import { NextRequest, NextResponse } from "next/server";
import {
  getPublicVendorProfile,
  getPublicVendorReviews,
} from "@/lib/vendor-storefront";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const vendor = await getPublicVendorProfile(slug);
    if (!vendor) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vendor not found" } },
        { status: 404 },
      );
    }
    if (vendor.storefront.showReviews === false) {
      return NextResponse.json({
        data: {
          summary: { count: 0, average: 0, distribution: [] },
          reviews: [],
        },
      });
    }
    const data = await getPublicVendorReviews(vendor.id);
    return NextResponse.json({ data, vendor });
  } catch (error) {
    console.error("GET /api/vendors/[slug]/reviews", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load reviews" } },
      { status: 500 },
    );
  }
}
