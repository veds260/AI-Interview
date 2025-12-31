import { NextResponse } from "next/server";
import { db, interviews, interviewMessages, questionBank, clients } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";

interface SessionState {
  questionIds: string[];
  currentIndex: number;
  followUpCount?: number;
}

// Generate a dynamic follow-up question using AI
async function generateFollowUpQuestion(
  question: string,
  response: string,
  clientContext?: {
    name?: string;
    topics?: string[];
    knowledgeBase?: string;
  }
): Promise<string | null> {
  try {
    const contextInfo = clientContext
      ? `
Client: ${clientContext.name || "Unknown"}
Topics of expertise: ${clientContext.topics?.join(", ") || "General"}
Knowledge base: ${clientContext.knowledgeBase || "None provided"}
`
      : "";

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer extracting compelling stories and insights from founders.
Your goal is to dig deeper into interesting responses to extract content that can become viral tweets, threads, and posts.

${contextInfo}

Guidelines:
- Ask follow-up questions that explore the "why" and emotional journey
- Look for unique insights, contrarian views, or unexpected lessons
- Try to get specific examples, numbers, or memorable quotes
- Keep questions conversational and natural
- Focus on extracting stories with clear narrative arcs`,
          },
          {
            role: "user",
            content: `The interviewer asked: "${question}"

The founder responded: "${response}"

Generate a single, natural follow-up question that digs deeper into something interesting from their response. The follow-up should help extract content that would make great social media posts.

Return ONLY the follow-up question, nothing else.`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Failed to generate follow-up:", error);
    return null;
  }
}

// Respond to shared interview (no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { response } = await request.json();

    if (!response?.trim()) {
      return NextResponse.json(
        { error: "Response is required" },
        { status: 400 }
      );
    }

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
    let clientContext: { name?: string; topics?: string[]; knowledgeBase?: string } | undefined;
    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });
      if (client) {
        clientContext = {
          name: client.name,
          topics: client.topicsOfExpertise as string[] | undefined,
          knowledgeBase: client.knowledgeBase as string | undefined,
        };
      }
    }

    const state = interview.sessionState as SessionState;
    if (!state?.questionIds) {
      return NextResponse.json(
        { error: "Invalid interview state" },
        { status: 400 }
      );
    }

    // Get the current question
    const currentQuestionId = state.questionIds[state.currentIndex];
    const currentQuestion = await db.query.questionBank.findFirst({
      where: eq(questionBank.id, currentQuestionId),
    });

    // Save the interviewer question message
    await db.insert(interviewMessages).values({
      interviewId: interview.id,
      role: "interviewer",
      content: currentQuestion?.question || "Question",
      questionId: currentQuestionId,
      targetedContentType: currentQuestion?.category,
    });

    // Save the response message
    await db.insert(interviewMessages).values({
      interviewId: interview.id,
      role: "client",
      content: response.trim(),
    });

    // Update questions asked
    const questionsAsked = (interview.questionsAsked as object[]) || [];
    questionsAsked.push({
      questionId: currentQuestionId,
      question: currentQuestion?.question,
      response: response.trim(),
      category: currentQuestion?.category,
      timestamp: new Date().toISOString(),
    });

    // Decide: generate AI follow-up or move to next bank question
    const followUpCount = state.followUpCount || 0;
    let nextQuestion: string | null = null;
    let isFollowUp = false;

    // Only generate follow-up if we haven't already for this base question
    if (followUpCount === 0 && response.trim().length > 50) {
      nextQuestion = await generateFollowUpQuestion(
        currentQuestion?.question || "",
        response.trim(),
        clientContext
      );
      if (nextQuestion) {
        isFollowUp = true;
      }
    }

    // If no follow-up or already did one, move to next bank question
    const shouldMoveToNext = !isFollowUp;
    const nextIndex = shouldMoveToNext ? state.currentIndex + 1 : state.currentIndex;
    const completed = nextIndex >= state.questionIds.length;

    // If moving to next question and not completed, get it from bank
    if (shouldMoveToNext && !completed) {
      const nextQuestionId = state.questionIds[nextIndex];
      const nextQuestionFromBank = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, nextQuestionId),
      });
      nextQuestion = nextQuestionFromBank?.question || null;
    }

    await db
      .update(interviews)
      .set({
        sessionState: {
          ...state,
          currentIndex: nextIndex,
          followUpCount: isFollowUp ? 1 : 0,
        },
        questionsAsked,
        questionsCount: (interview.questionsCount || 0) + 1,
        status: completed ? "completed" : "in_progress",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interview.id));

    // Update question usage count
    if (shouldMoveToNext && currentQuestion) {
      await db
        .update(questionBank)
        .set({ timesUsed: (currentQuestion.timesUsed || 0) + 1 })
        .where(eq(questionBank.id, currentQuestionId));
    }

    if (completed) {
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    return NextResponse.json({
      completed: false,
      nextQuestion,
      isFollowUp,
      progress: ((nextIndex + 1) / state.questionIds.length) * 100,
    });
  } catch (error) {
    console.error("Error responding to shared interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
