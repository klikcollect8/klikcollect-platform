import { NextRequest, NextResponse } from "next/server";
import { getReviews, addReview } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reviews = await getReviews(id);
    return NextResponse.json(reviews);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userName, rating, title, comment, verifiedPurchase } = body;

    if (!userName || !rating || !title || !comment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const review = await addReview({
      productId: id,
      userName,
      rating: parseInt(rating),
      title,
      comment,
      verifiedPurchase: verifiedPurchase || false,
      helpfulCount: 0,
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 },
    );
  }
}
