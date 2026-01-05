import { NextResponse } from "next/server";
import { db, interviews, interviewMessages, questionBank, clients } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";

interface ClientKnowledgeSummary {
  bio?: string;
  products?: string[];
  talkingPoints?: string[];
  voiceGuidelines?: string;
  previousInsights?: string[];
  recentTweets?: string[];
}

interface PreviousInterviewSummary {
  topic?: string;
  keyInsights: string[];
  topicsDiscussed: string[];
}

interface SessionState {
  questionIds: string[];
  currentIndex: number;
  followUpCount?: number;
  clientContext?: ClientKnowledgeSummary;
  previousInterviews?: PreviousInterviewSummary[];
  competitorTopics?: string[];
}

// Generate a dynamic follow-up question using AI with rich context
async function generateFollowUpQuestion(
  question: string,
  response: string,
  sessionContext: {
    clientName?: string;
    topics?: string[];
    clientContext?: ClientKnowledgeSummary;
    previousInterviews?: PreviousInterviewSummary[];
    competitorTopics?: string[];
    questionNumber?: number;
    previousQuestions?: string[];
  }
): Promise<string | null> {
  try {
    // Build context info
    let contextInfo = "";

    if (sessionContext.clientName) {
      contextInfo += `Founder: ${sessionContext.clientName}\n`;
    }

    if (sessionContext.topics?.length) {
      contextInfo += `Their expertise: ${sessionContext.topics.join(", ")}\n`;
    }

    const kb = sessionContext.clientContext;
    if (kb) {
      if (kb.products?.length) contextInfo += `Their products: ${kb.products.join(", ")}\n`;
      if (kb.talkingPoints?.length) contextInfo += `Topics they want to discuss: ${kb.talkingPoints.slice(0, 3).join("; ")}\n`;
    }

    if (sessionContext.competitorTopics?.length) {
      contextInfo += `Hot topics in their space: ${sessionContext.competitorTopics.slice(0, 5).join(", ")}\n`;
    }

    if (sessionContext.previousQuestions?.length) {
      contextInfo += `Already asked (AVOID similar): ${sessionContext.previousQuestions.slice(-3).join(" | ")}\n`;
    }

    // Rotate through different question approaches to add variety
    const questionApproaches = [
      "Ask about a CHALLENGE or obstacle they faced with this",
      "Ask WHY they made this choice over alternatives",
      "Ask about the IMPACT or results they saw",
      "Connect to a HOT TOPIC in their industry",
      "Ask what SURPRISED them about this",
      "Ask what they would do DIFFERENTLY now",
      "Ask about the TURNING POINT in this situation",
      "Ask what ADVICE they'd give based on this",
    ];

    const approachIndex = (sessionContext.questionNumber || 0) % questionApproaches.length;
    const currentApproach = questionApproaches[approachIndex];

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Generate ONE follow-up question based ONLY on what they just said.

ORIGINAL QUESTION: "${question}"

THEIR ANSWER: "${response.slice(0, 400)}"

YOUR TASK: ${currentApproach}

CRITICAL RULES:
- ONLY reference things they EXPLICITLY mentioned in their answer
- NEVER assume facts they didn't state (jobs, companies, strategies they never mentioned)
- Keep under 20 words
- If their answer is short/vague, ask them to elaborate on what they DID say
- NO generic questions like "how did that feel?" or "tell me more"

Return ONLY the question, nothing else.`,
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

    // Get client name and topics for additional context
    let clientName: string | undefined;
    let clientTopics: string[] | undefined;
    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });
      if (client) {
        clientName = client.name;
        clientTopics = client.topicsOfExpertise as string[] | undefined;
      }
    }

    const state = interview.sessionState as SessionState;
    if (!state?.questionIds || state.questionIds.length === 0) {
      console.error("Interview has no questions:", { interviewId: interview.id, sessionState: state });
      return NextResponse.json(
        { error: "This interview has no questions configured. Please request a new interview link." },
        { status: 400 }
      );
    }

    const currentIndex = state.currentIndex || 0;
    if (currentIndex >= state.questionIds.length) {
      // Already completed all questions
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    // Get the current question
    const currentQuestionId = state.questionIds[currentIndex];
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
      // Get previous questions to avoid repetition
      const previousQuestions = questionsAsked
        .slice(-5)
        .map((qa: any) => qa.question)
        .filter(Boolean);

      nextQuestion = await generateFollowUpQuestion(
        currentQuestion?.question || "",
        response.trim(),
        {
          clientName,
          topics: clientTopics,
          clientContext: state.clientContext,
          previousInterviews: state.previousInterviews,
          competitorTopics: state.competitorTopics,
          questionNumber: questionsAsked.length,
          previousQuestions,
        }
      );
      if (nextQuestion) {
        isFollowUp = true;
      }
    }

    // If no follow-up or already did one, move to next bank question
    const shouldMoveToNext = !isFollowUp;
    const nextIndex = shouldMoveToNext ? currentIndex + 1 : currentIndex;
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
