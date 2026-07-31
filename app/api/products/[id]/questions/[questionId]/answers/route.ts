import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ProductAnswer } from '@/types';

const dataDir = path.join(process.cwd(), 'data');
const questionsFile = path.join(dataDir, 'questions.json');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const body = await request.json();
    const { userName, answer } = body;
    
    const data = fs.readFileSync(questionsFile, 'utf-8');
    const questions = JSON.parse(data);
    
    const questionIndex = questions.findIndex((q: any) => q.id === questionId);
    if (questionIndex === -1) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    
    const newAnswer: ProductAnswer = {
      id: Date.now().toString(),
      userName: userName || 'Admin',
      answer,
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    if (!questions[questionIndex].answers) {
      questions[questionIndex].answers = [];
    }
    
    questions[questionIndex].answers.push(newAnswer);
    fs.writeFileSync(questionsFile, JSON.stringify(questions, null, 2));
    
    return NextResponse.json(newAnswer);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add answer' }, { status: 500 });
  }
}

