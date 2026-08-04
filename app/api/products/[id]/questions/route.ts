import { NextRequest, NextResponse } from "next/server";
import { getQuestions, addQuestion } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const questions = await getQuestions(id);
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch questions" },
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
    const { userName, question } = body;

    if (!userName || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const newQuestion = await addQuestion({
      productId: id,
      userName,
      question,
      answers: [],
    });

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 },
    );
  }
}
