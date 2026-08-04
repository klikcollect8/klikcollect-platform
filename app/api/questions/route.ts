import { NextRequest, NextResponse } from "next/server";
import { getAllQuestions } from "@/lib/data";

export async function GET(request: NextRequest) {
  try {
    const questions = await getAllQuestions();
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 },
    );
  }
}
