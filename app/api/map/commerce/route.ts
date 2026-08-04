import { NextResponse } from "next/server";
import { getMapCommercePayload } from "@/lib/map-commerce";

/** Aggregated vendors + product index for the commerce map */
export async function GET() {
  try {
    const data = await getMapCommercePayload();
    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/map/commerce", error);
    return NextResponse.json(
      {
        error: { code: "SERVER", message: "Failed to load map commerce data" },
      },
      { status: 500 },
    );
  }
}
