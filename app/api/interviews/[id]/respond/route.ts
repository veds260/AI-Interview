import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, interviewMessages, questionBank, clients } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { trackApiCall, estimateTokens } from "@/lib/utils/api-tracker";

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

interface SessionQuestion {
  id?: string;
  question: string;
  category: string;
}

interface SessionState {
  questions?: SessionQuestion[]; // New: full question objects
  questionIds?: string[]; // Legacy: just IDs for bank questions
  currentIndex: number;
  followUpCount?: number;
  pendingFollowUp?: string;
  clientContext?: ClientKnowledgeSummary;
  previousInterviews?: PreviousInterviewSummary[];
  competitorTopics?: string[];
  useCustomQuestions?: boolean;
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
  },
  trackingContext?: { interviewId: string; clientId?: string }
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

    const startTime = Date.now();
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
- If their answer is about the interview itself (complaints, confusion, requests to repeat/skip), return "SKIP"
- If their answer doesn't contain any substantive content to follow up on, return "SKIP"

Return ONLY the question (or "SKIP"), nothing else.`,
          },
        ],
      }),
    });

    const endTime = Date.now();

    if (!res.ok) {
      await trackApiCall({
        interviewId: trackingContext?.interviewId,
        clientId: trackingContext?.clientId,
        provider: "openrouter",
        model: "anthropic/claude-3-haiku",
        endpoint: "follow-up",
        durationMs: endTime - startTime,
        success: false,
        errorMessage: `HTTP ${res.status}`,
      });
      return null;
    }

    const data = await res.json();
    const result = data.choices?.[0]?.message?.content?.trim() || null;

    await trackApiCall({
      interviewId: trackingContext?.interviewId,
      clientId: trackingContext?.clientId,
      provider: "openrouter",
      model: "anthropic/claude-3-haiku",
      endpoint: "follow-up",
      inputTokens: data.usage?.prompt_tokens || estimateTokens(response),
      outputTokens: data.usage?.completion_tokens || estimateTokens(result || ""),
      durationMs: endTime - startTime,
      success: true,
    });

    return result;
  } catch (error) {
    console.error("Failed to generate follow-up:", error);
    return null;
  }
}

// Detect meta-responses (complaints about interview, process questions, off-topic)
// Returns true if the response is about the interview process rather than actual content
function isMetaResponse(response: string): boolean {
  const lowerResponse = response.toLowerCase();

  // Patterns that indicate meta-commentary about the interview
  const metaPatterns = [
    // Complaints about repetition
    /already (answered|said|mentioned|told you)/,
    /just (answered|said|mentioned|told you)/,
    /previous (question|answer)/,
    /repeating (this|the|same)/,
    /why (are we|am i|do you|did you) repeat/,
    /same question/,
    /asked (me |this )?before/,
    /didn't i (just )?answer/,
    // Questions about the interview process
    /what('s| is) (the point|this for)/,
    /why (are you|do you) asking/,
    /can we (move on|skip|next)/,
    /how (many|long|much more)/,
    // Confusion/frustration about the interview
    /i('m| am) confused/,
    /don't understand (the question|what you mean)/,
    /what do you mean/,
    /can you (clarify|explain|rephrase)/,
    // Very short dismissive responses
    /^(yes|no|maybe|i guess|sure|okay|ok|fine|whatever)\.?$/,
    // Off-topic commentary
    /this interview/,
    /these questions/,
    /your question/,
  ];

  for (const pattern of metaPatterns) {
    if (pattern.test(lowerResponse)) {
      console.log(`[Meta-response detected] Pattern matched: ${pattern}`);
      return true;
    }
  }

  // Also reject very short responses that are unlikely to be meaningful
  if (response.trim().length < 20) {
    console.log(`[Meta-response detected] Response too short: ${response.length} chars`);
    return true;
  }

  return false;
}

// Quick personalization - no API call, instant response
// CONSERVATIVE: Only personalize when it genuinely improves the question
function quickPersonalizeQuestion(
  baseQuestion: string,
  clientName?: string,
  kb?: ClientKnowledgeSummary,
  competitorTopics?: string[]
): string {
  // Most questions work better without forced personalization
  // Only add context when it's clearly relevant to the question topic

  const questionLower = baseQuestion.toLowerCase();

  // Questions about work/products - can mention their product
  if (kb?.products?.length && (
    questionLower.includes("your product") ||
    questionLower.includes("your company") ||
    questionLower.includes("your startup") ||
    questionLower.includes("what you're building")
  )) {
    return baseQuestion.replace(
      /your (product|company|startup)/gi,
      kb.products[0]
    );
  }

  // Questions about industry/trends - can mention competitor topics
  if (competitorTopics?.length && (
    questionLower.includes("industry") ||
    questionLower.includes("trend") ||
    questionLower.includes("market")
  )) {
    // Only 20% chance to add topic context - don't overdo it
    if (Math.random() < 0.2) {
      return `${baseQuestion} Especially regarding ${competitorTopics[0]}.`;
    }
  }

  // Default: return question as-is (most questions are better unmodified)
  return baseQuestion;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Run auth and params parsing in parallel with request body parsing
    const [session, { id }, body] = await Promise.all([
      auth(),
      params,
      request.json(),
    ]);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { response, audioKey, skipped } = body;

    if (!response?.trim()) {
      return NextResponse.json(
        { error: "Response is required" },
        { status: 400 }
      );
    }

    const isSkipped = skipped === true || response === "[SKIPPED]";

    // Fetch interview first (needed for clientId)
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get client info in background (don't await yet - will be used later)
    const clientPromise = interview.clientId
      ? db.query.clients.findFirst({ where: eq(clients.id, interview.clientId) })
      : Promise.resolve(null);

    const state = interview.sessionState as SessionState;

    // Calculate total questions - support both new and legacy format
    const totalQuestions = state.questions?.length || state.questionIds?.length || 0;

    if (totalQuestions === 0) {
      console.error("Interview has no questions:", { interviewId: id, sessionState: state });
      return NextResponse.json(
        { error: "This interview has no questions configured. Please create a new interview." },
        { status: 400 }
      );
    }

    const currentIndex = state.currentIndex || 0;
    if (currentIndex >= totalQuestions) {
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    // Get the current question - support both new questions array and legacy questionIds
    let currentQuestionData: { id?: string; question: string; category?: string } | null = null;

    if (state.questions && currentIndex < state.questions.length) {
      // NEW: Use questions array directly
      currentQuestionData = state.questions[currentIndex];
    } else if (state.questionIds && currentIndex < state.questionIds.length) {
      // LEGACY: Lookup from question bank
      const questionId = state.questionIds[currentIndex];
      const bankQuestion = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, questionId),
      });
      if (bankQuestion) {
        currentQuestionData = {
          id: bankQuestion.id,
          question: bankQuestion.question,
          category: bankQuestion.category || undefined,
        };
      }
    }

    // If there's a pending follow-up, use that as the actual question
    const actualQuestion = state.pendingFollowUp || currentQuestionData?.question || "Question";
    const isAnsweringFollowUp = !!state.pendingFollowUp;

    // Valid question categories from the database enum
    const validCategories = [
      "origin_story", "failure_story", "success_story", "turning_point",
      "hot_take", "contrarian_view", "industry_critique", "prediction",
      "technical", "framework", "how_to", "lessons", "values", "habits",
      "influences", "advice"
    ];

    // Only use category if it's valid, otherwise null
    const validCategory = currentQuestionData?.category && validCategories.includes(currentQuestionData.category)
      ? currentQuestionData.category
      : null;

    // Save messages (skip client message if question was skipped)
    if (isSkipped) {
      // Only save the interviewer question for skipped
      await db.insert(interviewMessages).values({
        interviewId: id,
        role: "interviewer",
        content: actualQuestion,
        questionId: isAnsweringFollowUp ? undefined : currentQuestionData?.id,
        targetedContentType: validCategory as any,
      });
    } else {
      // Save both messages in PARALLEL (they're independent)
      await Promise.all([
        db.insert(interviewMessages).values({
          interviewId: id,
          role: "interviewer",
          content: actualQuestion,
          questionId: isAnsweringFollowUp ? undefined : currentQuestionData?.id,
          targetedContentType: validCategory as any,
        }),
        db.insert(interviewMessages).values({
          interviewId: id,
          role: "client",
          content: response.trim(),
          audioUrl: audioKey || null,
        }),
      ]);
    }

    // Update questions asked (mark as skipped if applicable)
    const questionsAsked = (interview.questionsAsked as object[]) || [];
    if (!isSkipped) {
      questionsAsked.push({
        questionId: isAnsweringFollowUp ? undefined : currentQuestionData?.id,
        question: actualQuestion,
        response: response.trim(),
        category: currentQuestionData?.category,
        timestamp: new Date().toISOString(),
        isFollowUp: isAnsweringFollowUp,
      });
    }

    // For skipped questions: always move to next, no follow-ups
    // For answered questions: check for follow-ups
    const followUpCount = state.followUpCount || 0;
    let nextQuestion: string | null = null;
    let isFollowUp = false;

    // Only use follow-ups for non-skipped questions
    if (!isSkipped && state.pendingFollowUp && followUpCount === 0) {
      nextQuestion = state.pendingFollowUp;
      isFollowUp = true;
    }

    // Calculate next index - always move forward for skipped
    const shouldMoveToNext = isSkipped || !isFollowUp;
    const nextIndex = shouldMoveToNext ? currentIndex + 1 : currentIndex;

    // Count actual answered questions (not skipped ones)
    const answeredCount = questionsAsked.length;

    // Interview only completes when:
    // 1. We've gone through all questions AND
    // 2. At least one question was actually answered
    const completed = nextIndex >= totalQuestions && answeredCount > 0;

    // Now await client info (was fetching in background while we did other work)
    const client = await clientPromise;
    const clientName = client?.name;
    const clientTopics = client?.topicsOfExpertise as string[] | undefined;

    // If no follow-up, get the next question immediately
    if (!isFollowUp && !completed) {
      if (state.questions && nextIndex < state.questions.length) {
        // NEW: Get from questions array directly
        const nextQ = state.questions[nextIndex];
        nextQuestion = state.useCustomQuestions
          ? nextQ.question // Custom questions already personalized
          : quickPersonalizeQuestion(nextQ.question, clientName, state.clientContext, state.competitorTopics);
      } else if (state.questionIds && nextIndex < state.questionIds.length) {
        // LEGACY: Lookup from question bank
        const nextQuestionId = state.questionIds[nextIndex];
        const nextQuestionFromBank = await db.query.questionBank.findFirst({
          where: eq(questionBank.id, nextQuestionId),
        });
        if (nextQuestionFromBank?.question) {
          nextQuestion = quickPersonalizeQuestion(
            nextQuestionFromBank.question,
            clientName,
            state.clientContext,
            state.competitorTopics
          );
        }
      }
    }

    // BACKGROUND: Generate follow-up for the NEXT question cycle (don't await)
    // This runs async so it doesn't block the response
    // Skip follow-up generation for skipped questions or meta-responses
    const isMeta = isMetaResponse(response);
    if (!isSkipped && !isFollowUp && response.trim().length > 50 && !completed && !isMeta) {
      // Get previous questions to avoid repetition
      const previousQuestions = questionsAsked
        .slice(-5)
        .map((qa: any) => qa.question)
        .filter(Boolean);

      // Fire and forget - generate follow-up in background
      generateFollowUpQuestion(
        currentQuestionData?.question || "",
        response.trim(),
        {
          clientName,
          topics: clientTopics,
          clientContext: state.clientContext,
          previousInterviews: state.previousInterviews,
          competitorTopics: state.competitorTopics,
          questionNumber: questionsAsked.length,
          previousQuestions,
        },
        { interviewId: id, clientId: interview.clientId || undefined }
      ).then(async (followUp) => {
        // Check if AI returned SKIP or an invalid follow-up
        if (followUp && followUp.trim().toUpperCase() !== "SKIP" && followUp.length > 10) {
          // Store the generated follow-up in session state for next cycle
          const currentInterview = await db.query.interviews.findFirst({
            where: eq(interviews.id, id),
          });
          if (currentInterview) {
            const currentState = currentInterview.sessionState as SessionState;
            await db
              .update(interviews)
              .set({
                sessionState: {
                  ...currentState,
                  pendingFollowUp: followUp,
                },
                updatedAt: new Date(),
              })
              .where(eq(interviews.id, id));
            console.log("[Background] Follow-up generated and stored:", followUp.substring(0, 50));
          }
        } else {
          console.log("[Background] Follow-up skipped:", followUp);
        }
      }).catch((err) => {
        console.error("[Background] Failed to generate follow-up:", err);
      });
    }

    // Run DB updates in parallel
    await Promise.all([
      // 1. Update interview state
      db
        .update(interviews)
        .set({
          sessionState: {
            ...state,
            currentIndex: nextIndex,
            followUpCount: isFollowUp ? 1 : 0,
            pendingFollowUp: undefined,
          },
          questionsAsked,
          questionsCount: (interview.questionsCount || 0) + 1,
          status: completed ? "completed" : "in_progress",
          completedAt: completed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, id)),

      // 2. Update question usage count
      shouldMoveToNext && currentQuestionData?.id
        ? db
            .update(questionBank)
            .set({ timesUsed: sql`COALESCE(times_used, 0) + 1` })
            .where(eq(questionBank.id, currentQuestionData.id))
        : Promise.resolve(),
    ]);

    if (completed) {
      return NextResponse.json({
        completed: true,
        message: "Interview completed",
      });
    }

    // If we've gone through all questions but haven't answered any
    if (nextIndex >= totalQuestions && answeredCount === 0) {
      return NextResponse.json({
        completed: false,
        allSkipped: true,
        message: "Please answer at least one question to complete the interview.",
        questionsAnswered: 0,
        totalQuestions,
      });
    }

    // Progress based on answered questions, not position
    // This ensures skipped questions don't artificially inflate progress
    const progressPercent = (answeredCount / totalQuestions) * 100;

    return NextResponse.json({
      completed: false,
      nextQuestion,
      isFollowUp,
      progress: progressPercent,
      questionsAnswered: answeredCount,
      totalQuestions,
    });
  } catch (error) {
    console.error("Error responding to interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
