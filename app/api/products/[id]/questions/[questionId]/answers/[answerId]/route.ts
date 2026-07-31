import { NextRequest, NextResponse } from 'next/server';
import { softDeleteItem } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string; answerId: string }> }
) {
  try {
    const { questionId, answerId } = await params;
    const supabase = await createClient();
    
    // Get question data
    const { data: questionData, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (fetchError || !questionData) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Find the answer in the answers array
    const answers = questionData.answers || [];
    const answerIndex = answers.findIndex((a: any) => a.id === answerId);
    
    if (answerIndex === -1) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
    }

    const answerData = answers[answerIndex];

    // Soft delete (store in bin) - store answer with question context
    await softDeleteItem('answer', answerId, {
      ...answerData,
      question_id: questionId,
      product_id: questionData.product_id,
    });
    
    // Remove answer from the array
    const updatedAnswers = answers.filter((a: any) => a.id !== answerId);
    
    // Update question with new answers array
    const { error: updateError } = await supabase
      .from('questions')
      .update({ answers: updatedAnswers })
      .eq('id', questionId);

    if (updateError) {
      throw new Error(`Failed to delete answer: ${updateError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting answer:', error);
    return NextResponse.json({ error: 'Failed to delete answer' }, { status: 500 });
  }
}

