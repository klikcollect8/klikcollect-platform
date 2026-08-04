import { NextRequest, NextResponse } from "next/server";
import { getAllReviews } from "@/lib/data";

export async function GET(request: NextRequest) {
  try {
    const reviews = await getAllReviews();
    return NextResponse.json(reviews);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}
