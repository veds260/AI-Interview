import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, interviewMessages, questionBank, clients } from "@/lib/db";
import { eq, asc, inArray } from "drizzle-orm";

interface ClientKnowledgeSummary {
  bio?: string;
  products?: string[];
  talkingPoints?: string[];
  voiceGuidelines?: string;
  recentTweets?: string[];
}

interface SessionState {
  questionIds: string[];
  currentIndex: number;
  pendingFollowUp?: string; // Store follow-up question for resume
  followUpCount?: number;
  clientContext?: ClientKnowledgeSummary;
  competitorTopics?: string[];
}

// Quick personalization - just add a brief context prefix, no API call needed
// This eliminates latency while still making questions feel personal
function quickPersonalizeQuestion(
  baseQuestion: string,
  clientName?: string,
  kb?: ClientKnowledgeSummary,
  competitorTopics?: string[]
): string {
  // If no knowledge base, return the base question as-is
  if (!kb || (!kb.bio && !kb.products?.length && !kb.talkingPoints?.length)) {
    return baseQuestion;
  }

  // Build a quick personalization prefix based on available context
  let prefix = "";

  // Check if we have relevant context to add
  if (kb.products?.length && baseQuestion.toLowerCase().includes("work")) {
    prefix = `Given your work on ${kb.products[0]}, `;
  } else if (kb.talkingPoints?.length && competitorTopics?.length) {
    // If question relates to industry trends
    prefix = `With ${competitorTopics[0]} being a hot topic right now, `;
  } else if (kb.bio && kb.bio.length > 20) {
    // Extract a key phrase from bio for context
    const bioWords = kb.bio.split(" ").slice(0, 5).join(" ");
    if (bioWords.length > 10) {
      prefix = `Based on your background, `;
    }
  }

  // Only add prefix if it makes sense with the question
  if (prefix && !baseQuestion.toLowerCase().startsWith("given") &&
      !baseQuestion.toLowerCase().startsWith("based") &&
      !baseQuestion.toLowerCase().startsWith("since")) {
    // Make first letter lowercase if adding prefix
    const questionLower = baseQuestion.charAt(0).toLowerCase() + baseQuestion.slice(1);
    return prefix + questionLower;
  }

  return baseQuestion;
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

    // Get client name for personalization
    let clientName: string | undefined;
    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });
      clientName = client?.name;
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

    // Check if there's a pending follow-up question (for resume)
    if (state?.pendingFollowUp) {
      currentQuestion = state.pendingFollowUp;
    } else if (state?.questionIds && state.currentIndex < state.questionIds.length) {
      const questionId = state.questionIds[state.currentIndex];
      const question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, questionId),
      });

      if (question?.question) {
        // Quick personalize the base question (no API call - instant)
        currentQuestion = quickPersonalizeQuestion(
          question.question,
          clientName,
          state.clientContext,
          state.competitorTopics
        );
      }
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
