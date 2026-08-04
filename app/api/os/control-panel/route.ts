import { NextResponse } from "next/server";

/**
 * Platform feature flags are admin-only.
 * Vendors use a small storefront panel - no global control panel.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: {
        message:
          "Control panel moved to Admin (/admin). Vendor OS is store-scoped only.",
      },
    },
    { status: 403 },
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: {
        message:
          "Feature flags can only be changed from the Admin control panel.",
      },
    },
    { status: 403 },
  );
}
