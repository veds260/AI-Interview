import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, interviewMessages, questionBank, clients } from "@/lib/db";
import { eq } from "drizzle-orm";

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
  }
): Promise<string | null> {
  try {
    // Build rich context from knowledge base and previous interviews
    let contextInfo = "";

    if (sessionContext.clientName) {
      contextInfo += `Client: ${sessionContext.clientName}\n`;
    }

    if (sessionContext.topics?.length) {
      contextInfo += `Topics of expertise: ${sessionContext.topics.join(", ")}\n`;
    }

    // Add knowledge base context
    const kb = sessionContext.clientContext;
    if (kb) {
      if (kb.bio) contextInfo += `Bio: ${kb.bio}\n`;
      if (kb.products?.length) contextInfo += `Products/Services: ${kb.products.join(", ")}\n`;
      if (kb.talkingPoints?.length) contextInfo += `Key talking points: ${kb.talkingPoints.join("; ")}\n`;
      if (kb.voiceGuidelines) contextInfo += `Voice style: ${kb.voiceGuidelines}\n`;
    }

    // Add previous interview insights with FULL Q&A (critical for continuity)
    if (sessionContext.previousInterviews?.length) {
      contextInfo += "\n=== PREVIOUS INTERVIEWS - FULL HISTORY (you MUST reference this when relevant) ===\n";
      sessionContext.previousInterviews.forEach((prev, i) => {
        contextInfo += `\n--- Interview ${i + 1}${prev.topic ? ` (${prev.topic})` : ""} ---\n`;
        contextInfo += `Topics covered: ${prev.topicsDiscussed.join(", ")}\n`;
        contextInfo += "Previous Q&A:\n";
        prev.keyInsights.forEach((insight) => {
          contextInfo += `${insight}\n`;
        });
      });
      contextInfo += "\n=== END PREVIOUS INTERVIEWS ===\n";
    }

    // Add competitor/trending topics
    if (sessionContext.competitorTopics?.length) {
      contextInfo += `\nTrending topics from competitors: ${sessionContext.competitorTopics.join(", ")}\n`;
    }

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
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are an expert interviewer having an ongoing conversation with a founder across multiple sessions.
Your goal is to dig deeper into interesting responses to extract content that can become viral tweets, threads, and posts.

${contextInfo}

CRITICAL GUIDELINES:
1. You have FULL MEMORY of all previous interviews above. REFERENCE them when relevant.
2. If the founder mentions something they discussed before, acknowledge it: "Yes, you mentioned [topic] last time..."
3. If they ask what they said before, QUOTE their previous answer from the history above.
4. If they point out a topic was already covered, apologize and ask about a DIFFERENT aspect or a NEW topic.
5. NEVER ask the exact same question as in previous interviews.
6. Connect current answers to themes from past sessions to show continuity.
7. Look for unique insights, contrarian views, or unexpected lessons.
8. Try to get specific examples, numbers, or memorable quotes.
9. Keep questions conversational and natural.`,
          },
          {
            role: "user",
            content: `The interviewer asked: "${question}"

The founder responded: "${response}"

IMPORTANT: If the founder is asking about what they said before, complaining about a repeated question, or referencing past discussions, address that FIRST using the previous interview history above.

Otherwise, generate a single, natural follow-up question that digs deeper. Connect to themes from their previous interviews when relevant.

Return ONLY your response (either addressing their concern OR a follow-up question), nothing else.`,
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
      console.error("Interview has no questions:", { interviewId: id, sessionState: state });
      return NextResponse.json(
        { error: "This interview has no questions configured. Please create a new interview." },
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
      interviewId: id,
      role: "interviewer",
      content: currentQuestion?.question || "Question",
      questionId: currentQuestionId,
      targetedContentType: currentQuestion?.category,
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
      questionId: currentQuestionId,
      question: currentQuestion?.question,
      response: response.trim(),
      category: currentQuestion?.category,
      timestamp: new Date().toISOString(),
    });

    // Decide: generate AI follow-up or move to next bank question
    // Generate follow-up for every question to dig deeper (max 1 follow-up per base question)
    const followUpCount = state.followUpCount || 0;
    let nextQuestion: string | null = null;
    let isFollowUp = false;

    // Only generate follow-up if we haven't already for this base question
    if (followUpCount === 0 && response.trim().length > 50) {
      nextQuestion = await generateFollowUpQuestion(
        currentQuestion?.question || "",
        response.trim(),
        {
          clientName,
          topics: clientTopics,
          // Use rich context from session state (populated at interview creation)
          clientContext: state.clientContext,
          previousInterviews: state.previousInterviews,
          competitorTopics: state.competitorTopics,
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
          followUpCount: isFollowUp ? 1 : 0, // Reset for new base question
        },
        questionsAsked,
        questionsCount: (interview.questionsCount || 0) + 1,
        status: completed ? "completed" : "in_progress",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

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
    console.error("Error responding to interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
