import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, questionBank, interviewMessages } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

interface SessionState {
  questionIds: string[];
  currentIndex: number;
  pendingFollowUp?: string;
  followUpCount?: number;
}

// POST /api/interviews/[id]/continue - Get the next question after resuming
// This handles the case where the user answered but the session state is out of sync
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

    let state = interview.sessionState as SessionState;
    if (!state?.questionIds || state.questionIds.length === 0) {
      return NextResponse.json(
        { error: "Interview has no questions" },
        { status: 400 }
      );
    }

    // Get the last few messages to check state
    const recentMessages = await db
      .select()
      .from(interviewMessages)
      .where(eq(interviewMessages.interviewId, id))
      .orderBy(desc(interviewMessages.createdAt))
      .limit(5);

    // Check if the current question was already answered
    // by looking at questionsAsked
    const questionsAsked = (interview.questionsAsked as any[]) || [];
    let currentIndex = state.currentIndex || 0;

    // Get the current question text
    const currentQuestionId = state.questionIds[currentIndex];
    const currentQuestionRecord = await db.query.questionBank.findFirst({
      where: eq(questionBank.id, currentQuestionId),
    });
    const currentQuestionText = state.pendingFollowUp || currentQuestionRecord?.question;

    // Check if this question was already answered in questionsAsked
    const alreadyAnswered = questionsAsked.some(
      (qa: any) => qa.question === currentQuestionText
    );

    // If already answered but state not advanced, advance it now
    if (alreadyAnswered && !state.pendingFollowUp) {
      currentIndex = currentIndex + 1;

      // Update session state
      await db
        .update(interviews)
        .set({
          sessionState: {
            ...state,
            currentIndex,
            pendingFollowUp: undefined,
            followUpCount: 0,
          },
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, id));

      state = { ...state, currentIndex, pendingFollowUp: undefined };
    }

    // Check if interview is completed after potential advancement
    if (currentIndex >= state.questionIds.length) {
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    // Get the next question
    let nextQuestion: string | null = null;

    if (state.pendingFollowUp && !alreadyAnswered) {
      nextQuestion = state.pendingFollowUp;
    } else {
      const questionId = state.questionIds[currentIndex];
      const question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, questionId),
      });
      nextQuestion = question?.question || null;
    }

    if (!nextQuestion) {
      return NextResponse.json(
        { error: "Could not find next question" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      completed: false,
      nextQuestion,
      progress: ((currentIndex + 1) / state.questionIds.length) * 100,
    });
  } catch (error) {
    console.error("Error continuing interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
