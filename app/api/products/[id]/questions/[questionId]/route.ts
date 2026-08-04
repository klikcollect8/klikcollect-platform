import { NextRequest, NextResponse } from "next/server";
import { softDeleteItem } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { questionId } = await params;
    const supabase = await createClient();

    // Get question data before deleting
    const { data: questionData, error: fetchError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (fetchError || !questionData) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    // Soft delete (store in bin)
    await softDeleteItem("question", questionId, questionData);

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);

    if (error) {
      throw new Error(`Failed to delete question: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 },
    );
  }
}
