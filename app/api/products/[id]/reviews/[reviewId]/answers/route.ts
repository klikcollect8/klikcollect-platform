import { NextRequest, NextResponse } from "next/server";
import { addReviewAnswer } from "@/lib/data";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { userName, answer } = body;

    if (!answer || !answer.trim()) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 },
      );
    }

    const reviewAnswer = await addReviewAnswer({
      reviewId,
      userName: userName || "Admin",
      answer: answer.trim(),
      helpfulCount: 0,
    });

    return NextResponse.json(reviewAnswer, { status: 201 });
  } catch (error) {
    console.error("Error adding review answer:", error);
    return NextResponse.json(
      { error: "Failed to add review answer" },
      { status: 500 },
    );
  }
}
