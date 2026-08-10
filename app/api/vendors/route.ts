import { NextResponse } from "next/server";
import { getAdmittedVendors } from "@/lib/admitted-vendors";

/** Public directory - admitted vendors only */
export async function GET() {
  try {
    const vendors = await getAdmittedVendors();
    return NextResponse.json(
      { data: { vendors } },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/vendors", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load vendors" } },
      { status: 500 },
    );
  }
}
