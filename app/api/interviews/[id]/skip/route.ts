import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, questionBank } from "@/lib/db";
import { eq } from "drizzle-orm";

interface SessionState {
  questionIds: string[];
  currentIndex: number;
}

export async function POST(
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

    const state = interview.sessionState as SessionState;
    if (!state?.questionIds) {
      return NextResponse.json(
        { error: "Invalid interview state" },
        { status: 400 }
      );
    }

    // Move to next question
    const nextIndex = state.currentIndex + 1;
    const completed = nextIndex >= state.questionIds.length;

    await db
      .update(interviews)
      .set({
        sessionState: { ...state, currentIndex: nextIndex },
        status: completed ? "completed" : "in_progress",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    if (completed) {
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    // Get next question
    const nextQuestionId = state.questionIds[nextIndex];
    const nextQuestion = await db.query.questionBank.findFirst({
      where: eq(questionBank.id, nextQuestionId),
    });

    return NextResponse.json({
      completed: false,
      nextQuestion: nextQuestion?.question,
      progress: ((nextIndex + 1) / state.questionIds.length) * 100,
    });
  } catch (error) {
    console.error("Error skipping question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
