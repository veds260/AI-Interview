import { NextResponse } from "next/server";
import { db, interviews, questionBank, clients } from "@/lib/db";
import { eq, gt, and, isNotNull } from "drizzle-orm";

// Get interview by share token (no auth required)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find interview with valid share token
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
    const state = interview.sessionState as {
      questionIds?: string[];
      currentIndex?: number;
    };

    let currentQuestion = null;
    if (state?.questionIds && state.questionIds.length > 0) {
      const currentQuestionId = state.questionIds[state.currentIndex || 0];
      const question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, currentQuestionId),
      });
      currentQuestion = question?.question || null;
    }

    return NextResponse.json({
      interview: {
        id: interview.id,
        mode: interview.mode,
        status: interview.status,
        title: interview.title,
        guestName: interview.guestName,
        questionsCount: interview.questionsCount,
        sessionState: interview.sessionState,
        transcript: interview.transcript,
        questionsAsked: interview.questionsAsked,
        recordingUrl: interview.recordingUrl,
        completedAt: interview.completedAt,
      },
      currentQuestion,
      client: clientInfo,
      progress: state?.questionIds
        ? ((state.currentIndex || 0) / state.questionIds.length) * 100
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

    // Find interview with valid share token
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

    // Update guest name and start interview if needed
    await db
      .update(interviews)
      .set({
        guestName,
        status: interview.status === "scheduled" ? "in_progress" : interview.status,
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
