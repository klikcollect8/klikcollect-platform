import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ProductAnswer } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { questionId } = await params;
    const body = await request.json();
    const { userName, answer } = body;

    const admin = createAdminClient();
    const supabase = admin || (await createClient());

    const { data: question, error: fetchError } = await supabase
      .from("questions")
      .select("id, answers")
      .eq("id", questionId)
      .maybeSingle();

    if (fetchError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const newAnswer: ProductAnswer = {
      id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userName: userName || "Admin",
      answer,
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
    };

    const answers = Array.isArray(question.answers) ? question.answers : [];
    const updated = [...answers, newAnswer];

    const { error } = await supabase
      .from("questions")
      .update({ answers: updated })
      .eq("id", questionId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to add answer" },
        { status: 500 },
      );
    }

    return NextResponse.json(newAnswer);
  } catch {
    return NextResponse.json({ error: "Failed to add answer" }, { status: 500 });
  }
}
