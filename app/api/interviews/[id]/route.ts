import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, interviewMessages, questionBank } from "@/lib/db";
import { eq, asc, inArray } from "drizzle-orm";

interface SessionState {
  questionIds: string[];
  currentIndex: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await db
      .select()
      .from(interviewMessages)
      .where(eq(interviewMessages.interviewId, id))
      .orderBy(asc(interviewMessages.createdAt));

    // Get current question
    const state = interview.sessionState as SessionState;
    let currentQuestion = null;

    if (state?.questionIds && state.currentIndex < state.questionIds.length) {
      const questionId = state.questionIds[state.currentIndex];
      const question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, questionId),
      });
      currentQuestion = question?.question || null;
    }

    return NextResponse.json({
      interview,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })),
      currentQuestion,
    });
  } catch (error) {
    console.error("Error fetching interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
