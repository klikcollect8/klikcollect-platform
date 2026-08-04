import { NextRequest, NextResponse } from "next/server";
import {
  getPublicVendorHours,
  getPublicVendorProfile,
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
    if (vendor.storefront.showHours === false) {
      return NextResponse.json({ data: [] });
    }
    const hours = await getPublicVendorHours(vendor.id);
    return NextResponse.json({ data: hours, vendor });
  } catch (error) {
    console.error("GET /api/vendors/[slug]/hours", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load hours" } },
      { status: 500 },
    );
  }
}
