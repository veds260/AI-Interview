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

// Personalize a base question using knowledge base context
async function personalizeQuestion(
  baseQuestion: string,
  clientName?: string,
  kb?: ClientKnowledgeSummary,
  competitorTopics?: string[]
): Promise<string> {
  // If no knowledge base, return the base question as-is
  if (!kb || (!kb.bio && !kb.products?.length && !kb.talkingPoints?.length)) {
    return baseQuestion;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return baseQuestion;

  try {
    let context = "";
    if (clientName) context += `Name: ${clientName}\n`;
    if (kb.bio) context += `Bio: ${kb.bio}\n`;
    if (kb.products?.length) context += `Products/Services: ${kb.products.join(", ")}\n`;
    if (kb.talkingPoints?.length) context += `Key talking points: ${kb.talkingPoints.join("; ")}\n`;
    if (competitorTopics?.length) context += `Trending topics in their space: ${competitorTopics.slice(0, 5).join(", ")}\n`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: `You personalize interview questions based on client background.

CLIENT BACKGROUND:
${context}

RULES:
1. Take the base question and make it more relevant to THIS specific person
2. Reference their industry, products, or expertise naturally
3. Frame it as research you did: "Given your work in X..." or "Since you focus on Y..."
4. NEVER say "you told me" or "you mentioned" - you haven't talked yet
5. Keep the same intent/spirit of the original question
6. Keep it conversational and natural, not stiff
7. Return ONLY the personalized question, nothing else`,
          },
          {
            role: "user",
            content: `Personalize this question for the client above:

"${baseQuestion}"

Return ONLY the personalized question.`,
          },
        ],
      }),
    });

    if (!res.ok) return baseQuestion;

    const data = await res.json();
    const personalized = data.choices?.[0]?.message?.content?.trim();
    return personalized || baseQuestion;
  } catch (error) {
    console.error("Failed to personalize question:", error);
    return baseQuestion;
  }
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
        // Personalize the base question using knowledge base
        currentQuestion = await personalizeQuestion(
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
