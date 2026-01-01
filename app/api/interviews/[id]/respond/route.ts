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
  pendingFollowUp?: string;
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
            content: `You are an expert interviewer conducting a content extraction interview with a founder.
Your goal is to dig deeper into their responses to extract content for viral tweets, threads, and posts.

=== KNOWLEDGE BASE (Background info about the founder - DO NOT say "you told me" about this) ===
${knowledgeBaseInfo || "No background info available"}
=== END KNOWLEDGE BASE ===
${previousInterviewsInfo}

CRITICAL RULES FOR USING CONTEXT:

1. KNOWLEDGE BASE = Background research you did BEFORE meeting them
   - Use it to ask BETTER questions: "Given your work in [X], what do you think about..."
   - Frame it as research: "I saw you're focused on [product], how does that relate to..."
   - Reference their expertise: "Since you work in [industry], would you say..."
   - NEVER say "you mentioned" or "last time we talked" about knowledge base info

2. PREVIOUS INTERVIEWS = Things they ACTUALLY SAID in past interview sessions
   - ONLY reference these as past conversations: "Last time we talked, you said..."
   - If no previous interviews section exists, you have NEVER talked to them before

3. GENERAL GUIDELINES:
   - Ask for specific examples, numbers, or stories
   - Look for contrarian views or unexpected lessons
   - Keep questions natural and conversational
   - Dig deeper into interesting parts of their response`,
          },
          {
            role: "user",
            content: `Question asked: "${question}"

Founder's response: "${response}"

Generate ONE follow-up question that:
1. Digs deeper into something interesting from their response
2. Optionally connects to their expertise/background from the knowledge base (but frame it as research, NOT as something they told you)
3. Sounds natural and conversational

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

// Personalize a base question using knowledge base context
async function personalizeBaseQuestion(
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

    // Get the current question (check for pending follow-up first)
    const currentQuestionId = state.questionIds[currentIndex];
    const currentQuestion = await db.query.questionBank.findFirst({
      where: eq(questionBank.id, currentQuestionId),
    });

    // If there's a pending follow-up, use that as the actual question
    const actualQuestion = state.pendingFollowUp || currentQuestion?.question || "Question";
    const isAnsweringFollowUp = !!state.pendingFollowUp;

    // Save the interviewer question message
    await db.insert(interviewMessages).values({
      interviewId: id,
      role: "interviewer",
      content: actualQuestion,
      questionId: isAnsweringFollowUp ? undefined : currentQuestionId,
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
      questionId: isAnsweringFollowUp ? undefined : currentQuestionId,
      question: actualQuestion,
      response: response.trim(),
      category: currentQuestion?.category,
      timestamp: new Date().toISOString(),
      isFollowUp: isAnsweringFollowUp,
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

    // If moving to next question and not completed, get it from bank and personalize
    if (shouldMoveToNext && !completed) {
      const nextQuestionId = state.questionIds[nextIndex];
      const nextQuestionFromBank = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, nextQuestionId),
      });

      if (nextQuestionFromBank?.question) {
        // Personalize the base question using knowledge base
        nextQuestion = await personalizeBaseQuestion(
          nextQuestionFromBank.question,
          clientName,
          state.clientContext,
          state.competitorTopics
        );
      }
    }

    await db
      .update(interviews)
      .set({
        sessionState: {
          ...state,
          currentIndex: nextIndex,
          followUpCount: isFollowUp ? 1 : 0, // Reset for new base question
          // Store follow-up for resume, clear when moving to next question
          pendingFollowUp: isFollowUp ? nextQuestion : undefined,
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
