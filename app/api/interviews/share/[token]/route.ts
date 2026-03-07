import { NextResponse } from "next/server";
import { db, interviews, questionBank, clients } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";

interface SessionState {
  questionIds?: string[];
  questions?: Array<{ id?: string; question: string; category: string }>;
  currentIndex?: number;
}

// Get interview by share token (no auth required)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const interview = await db.query.interviews.findFirst({
      where: and(
        eq(interviews.shareToken, token),
        gt(interviews.shareTokenExpiresAt, new Date())
      ),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Get client info for context
    let clientInfo = null;
    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });
      if (client) {
        clientInfo = {
          name: client.name,
          brandName: client.brandName,
        };
      }
    }

    // Get current question
    const state = interview.sessionState as SessionState;
    const currentIndex = state?.currentIndex || 0;

    let currentQuestion = null;
    // Try questions array first (new format), fall back to questionIds (legacy)
    if (state?.questions && state.questions.length > 0 && currentIndex < state.questions.length) {
      currentQuestion = state.questions[currentIndex].question;
    } else if (state?.questionIds && state.questionIds.length > 0 && currentIndex < state.questionIds.length) {
      const currentQuestionId = state.questionIds[currentIndex];
      const question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, currentQuestionId),
      });
      currentQuestion = question?.question || null;
    }

    const totalQuestions = state?.questions?.length || state?.questionIds?.length || 0;

    // Don't expose transcript or full Q&A to the client
    return NextResponse.json({
      interview: {
        id: interview.id,
        mode: interview.mode,
        status: interview.status,
        title: interview.title,
        guestName: interview.guestName,
        questionsCount: interview.questionsCount,
        completedAt: interview.completedAt,
      },
      currentQuestion,
      client: clientInfo,
      progress: totalQuestions > 0
        ? (currentIndex / totalQuestions) * 100
        : 0,
    });
  } catch (error) {
    console.error("Error fetching shared interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Set guest name for the interview
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { guestName } = await request.json();

    const interview = await db.query.interviews.findFirst({
      where: and(
        eq(interviews.shareToken, token),
        gt(interviews.shareTokenExpiresAt, new Date())
      ),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Resume if paused, start if scheduled
    const newStatus = ["scheduled", "paused"].includes(interview.status)
      ? "in_progress"
      : interview.status;

    await db
      .update(interviews)
      .set({
        guestName,
        status: newStatus,
        startedAt: interview.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interview.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating guest name:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
