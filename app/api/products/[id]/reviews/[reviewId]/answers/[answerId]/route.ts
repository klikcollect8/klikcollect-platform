import { NextRequest, NextResponse } from 'next/server';
import { deleteReviewAnswer } from '@/lib/data';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string; answerId: string }> }
) {
  try {
    const { answerId } = await params;
    
    const success = await deleteReviewAnswer(answerId);
    
    if (!success) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review answer:', error);
    return NextResponse.json({ error: 'Failed to delete answer' }, { status: 500 });
  }
}



