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
  },
  trackingContext?: { interviewId: string; clientId?: string }
): Promise<string | null> {
  try {
    // Build separate sections for knowledge base vs previous interviews
    let knowledgeBaseInfo = "";
    let previousInterviewsInfo = "";

    if (sessionContext.clientName) {
      knowledgeBaseInfo += `Name: ${sessionContext.clientName}\n`;
    }

    if (sessionContext.topics?.length) {
      knowledgeBaseInfo += `Topics of expertise: ${sessionContext.topics.join(", ")}\n`;
    }

    // Add knowledge base context (STATIC INFO - NOT from conversations)
    const kb = sessionContext.clientContext;
    if (kb) {
      if (kb.bio) knowledgeBaseInfo += `Bio: ${kb.bio}\n`;
      if (kb.products?.length) knowledgeBaseInfo += `Products/Services: ${kb.products.join(", ")}\n`;
      if (kb.talkingPoints?.length) knowledgeBaseInfo += `Key talking points they want to discuss: ${kb.talkingPoints.join("; ")}\n`;
      if (kb.voiceGuidelines) knowledgeBaseInfo += `Voice style: ${kb.voiceGuidelines}\n`;
      if (kb.recentTweets?.length) knowledgeBaseInfo += `Recent tweets/posts: ${kb.recentTweets.slice(0, 5).join(" | ")}\n`;
    }

    // Add competitor/trending topics
    if (sessionContext.competitorTopics?.length) {
      knowledgeBaseInfo += `Trending topics from competitors: ${sessionContext.competitorTopics.join(", ")}\n`;
    }

    // Add ACTUAL previous interview Q&A (things they actually said in past sessions)
    if (sessionContext.previousInterviews?.length) {
      previousInterviewsInfo = "\n=== ACTUAL PREVIOUS INTERVIEW CONVERSATIONS ===\n";
      previousInterviewsInfo += "(You CAN reference these as 'last time we talked' or 'you mentioned before')\n";
      sessionContext.previousInterviews.forEach((prev, i) => {
        previousInterviewsInfo += `\n--- Interview ${i + 1}${prev.topic ? ` (${prev.topic})` : ""} ---\n`;
        previousInterviewsInfo += `Topics covered: ${prev.topicsDiscussed.join(", ")}\n`;
        previousInterviewsInfo += "Q&A:\n";
        prev.keyInsights.forEach((insight) => {
          previousInterviewsInfo += `${insight}\n`;
        });
      });
      previousInterviewsInfo += "\n=== END PREVIOUS INTERVIEWS ===\n";
    }

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
        max_tokens: 100, // Keep questions SHORT
        messages: [
          {
            role: "system",
            content: `You generate SHORT, CLEAR follow-up questions for content interviews.

CONTEXT (for reference only):
${knowledgeBaseInfo || "No background available"}
${previousInterviewsInfo}

RULES:
1. Questions must be 1 sentence, under 20 words
2. Be direct and specific - no fluff
3. Ask for: examples, numbers, stories, or hot takes
4. NEVER reference knowledge base as "you told me" - use "given your work in X..."
5. Match their energy - casual if they're casual`,
          },
          {
            role: "user",
            content: `They answered: "${response.slice(0, 500)}"

Ask ONE short follow-up (under 20 words). Just the question, nothing else.`,
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

    // Track successful API call
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

// Quick personalization - no API call, instant response
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

  if (kb.products?.length && baseQuestion.toLowerCase().includes("work")) {
    prefix = `Given your work on ${kb.products[0]}, `;
  } else if (kb.talkingPoints?.length && competitorTopics?.length) {
    prefix = `With ${competitorTopics[0]} being a hot topic right now, `;
  } else if (kb.bio && kb.bio.length > 20) {
    prefix = `Based on your background, `;
  }

  // Only add prefix if it makes sense
  if (prefix && !baseQuestion.toLowerCase().startsWith("given") &&
      !baseQuestion.toLowerCase().startsWith("based") &&
      !baseQuestion.toLowerCase().startsWith("since")) {
    const questionLower = baseQuestion.charAt(0).toLowerCase() + baseQuestion.slice(1);
    return prefix + questionLower;
  }

  return baseQuestion;
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
    const { response } = await request.json();

    if (!response?.trim()) {
      return NextResponse.json(
        { error: "Response is required" },
        { status: 400 }
      );
    }

    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get client info (runs in parallel with nothing else critical)
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

    // Save the interviewer question message
    await db.insert(interviewMessages).values({
      interviewId: id,
      role: "interviewer",
      content: actualQuestion,
      questionId: isAnsweringFollowUp ? undefined : currentQuestionData?.id,
      targetedContentType: currentQuestionData?.category as any,
    });

    // Save the client response message
    await db.insert(interviewMessages).values({
      interviewId: id,
      role: "client",
      content: response.trim(),
    });

    // Update questions asked
    const questionsAsked = (interview.questionsAsked as object[]) || [];
    questionsAsked.push({
      questionId: isAnsweringFollowUp ? undefined : currentQuestionData?.id,
      question: actualQuestion,
      response: response.trim(),
      category: currentQuestionData?.category,
      timestamp: new Date().toISOString(),
      isFollowUp: isAnsweringFollowUp,
    });

    // FAST RESPONSE ARCHITECTURE:
    // 1. If there's a pending follow-up (generated in background last cycle), use it
    // 2. Otherwise, immediately return the next question
    // 3. Start generating the follow-up in background for the NEXT cycle

    const followUpCount = state.followUpCount || 0;
    let nextQuestion: string | null = null;
    let isFollowUp = false;

    // Check if we have a pending follow-up from background generation
    if (state.pendingFollowUp && followUpCount === 0) {
      nextQuestion = state.pendingFollowUp;
      isFollowUp = true;
    }

    // Calculate next index
    const shouldMoveToNext = !isFollowUp;
    const nextIndex = shouldMoveToNext ? currentIndex + 1 : currentIndex;
    const completed = nextIndex >= totalQuestions;

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
    if (!isFollowUp && response.trim().length > 50 && !completed) {
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
        },
        { interviewId: id, clientId: interview.clientId || undefined }
      ).then(async (followUp) => {
        if (followUp) {
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
        }
      }).catch((err) => {
        console.error("[Background] Failed to generate follow-up:", err);
      });
    }

    await db
      .update(interviews)
      .set({
        sessionState: {
          ...state,
          currentIndex: nextIndex,
          followUpCount: isFollowUp ? 1 : 0, // Reset for new base question
          // Clear pending follow-up since we used it (or didn't have one)
          pendingFollowUp: undefined,
        },
        questionsAsked,
        questionsCount: (interview.questionsCount || 0) + 1,
        status: completed ? "completed" : "in_progress",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    // Update question usage count (only for bank questions with IDs)
    if (shouldMoveToNext && currentQuestionData?.id) {
      await db
        .update(questionBank)
        .set({ timesUsed: sql`COALESCE(times_used, 0) + 1` })
        .where(eq(questionBank.id, currentQuestionData.id));
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
      progress: ((nextIndex + 1) / totalQuestions) * 100,
    });
  } catch (error) {
    console.error("Error responding to interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
