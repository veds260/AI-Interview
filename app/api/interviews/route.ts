import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients, questionBank, users, competitors } from "@/lib/db";
import { desc, eq, and, isNull, notInArray, sql } from "drizzle-orm";
import { trackApiCall, estimateTokens } from "@/lib/utils/api-tracker";
import { elevenlabs } from "@/lib/services/elevenlabs";

interface KnowledgeBase {
  bio?: string;
  products?: string[];
  talkingPoints?: string[];
  pastInterviews?: string[];
  voiceGuidelines?: string;
  notes?: string;
  typefullyTweets?: Array<{ content: string }>;
  insights?: string[];
}

interface PreviousInterviewContent {
  topic?: string;
  keyInsights: string[];
  topicsDiscussed: string[];
}

interface GeneratedQuestion {
  question: string;
  category: string;
  reasoning: string;
}

// Simple in-memory cache for generated questions (30 min TTL)
const questionCache = new Map<string, { questions: GeneratedQuestion[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Check if we have enough context to generate custom questions
function hasRichContext(
  kb: KnowledgeBase | undefined,
  previousInterviews: PreviousInterviewContent[],
  competitorTopics: string[]
): boolean {
  const hasBio = !!kb?.bio && kb.bio.length > 50;
  const hasProducts = (kb?.products?.length || 0) > 0;
  const hasTalkingPoints = (kb?.talkingPoints?.length || 0) > 0;
  const hasPastInterviews = previousInterviews.length > 0;
  const hasCompetitorTopics = competitorTopics.length > 0;
  const hasTweets = (kb?.typefullyTweets?.length || 0) > 0;

  // Need at least 2 sources of context for good questions
  const contextSources = [
    hasBio,
    hasProducts,
    hasTalkingPoints,
    hasPastInterviews,
    hasCompetitorTopics,
    hasTweets,
  ].filter(Boolean).length;

  return contextSources >= 2;
}

// Generate custom questions using AI based on client context
async function generateCustomQuestions(
  clientName: string,
  kb: KnowledgeBase | undefined,
  previousInterviews: PreviousInterviewContent[],
  competitorTopics: string[],
  alreadyAskedQuestions: string[],
  clientId?: string
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  // Check cache first (use clientId as key)
  if (clientId) {
    const cached = questionCache.get(clientId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Questions] Using cached questions for ${clientName} (${cached.questions.length} questions)`);
      return cached.questions;
    }
  }

  // Build context sections
  let contextPrompt = `You are generating interview questions for ${clientName}.\n\n`;

  if (kb?.bio) {
    contextPrompt += `=== ABOUT THEM ===\n${kb.bio}\n\n`;
  }

  if (kb?.products?.length) {
    contextPrompt += `=== THEIR PRODUCTS/SERVICES ===\n${kb.products.join(", ")}\n\n`;
  }

  if (kb?.talkingPoints?.length) {
    contextPrompt += `=== TOPICS THEY WANT TO DISCUSS ===\n${kb.talkingPoints.join("\n")}\n\n`;
  }

  if (kb?.typefullyTweets?.length) {
    const recentTweets = kb.typefullyTweets.slice(0, 8).map(t => t.content).join("\n---\n");
    contextPrompt += `=== THEIR RECENT TWEETS/POSTS ===\n${recentTweets}\n\n`;
  }

  if (previousInterviews.length > 0) {
    contextPrompt += `=== PAST INTERVIEW CONVERSATIONS ===\n`;
    contextPrompt += `(Build on these - dig deeper, follow up on interesting points, explore new angles)\n`;
    previousInterviews.slice(0, 3).forEach((interview, i) => {
      contextPrompt += `\n--- Previous Session ${i + 1}${interview.topic ? ` (${interview.topic})` : ""} ---\n`;
      interview.keyInsights.slice(0, 5).forEach(insight => {
        contextPrompt += `${insight}\n`;
      });
    });
    contextPrompt += `\n`;
  }

  if (competitorTopics.length > 0) {
    contextPrompt += `=== TRENDING TOPICS IN THEIR SPACE ===\n${competitorTopics.slice(0, 10).join(", ")}\n\n`;
  }

  if (alreadyAskedQuestions.length > 0) {
    contextPrompt += `=== QUESTIONS ALREADY ASKED (AVOID REPEATING) ===\n`;
    alreadyAskedQuestions.slice(0, 20).forEach(q => {
      contextPrompt += `- ${q}\n`;
    });
    contextPrompt += `\n`;
  }

  const startTime = Date.now();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: `You generate personalized interview questions that extract unique stories, insights, and hot takes.

QUESTION TYPES TO INCLUDE:
1. Origin/Journey questions - their path, pivotal moments
2. Failure/Learning stories - specific mistakes and lessons
3. Hot takes - controversial opinions they hold
4. Behind-the-scenes - how they actually work/think
5. Future predictions - where they see things going
6. Tactical advice - specific frameworks or tips they use

RULES:
- Questions must be SPECIFIC to their context, not generic
- Build on past conversations - "Last time you mentioned X, tell me more about..."
- Reference their actual products, tweets, or talking points
- Ask for STORIES and EXAMPLES, not abstract opinions
- Each question should have viral/clip potential
- Mix easy warmup questions with deeper probing ones
- 1-2 sentences max per question

Return JSON array with 12-15 questions:
[{"question": "...", "category": "origin_story|failure_story|hot_take|behind_scenes|prediction|tactical", "reasoning": "why this question for them"}]`,
          },
          {
            role: "user",
            content: contextPrompt + "\n\nGenerate 12-15 personalized interview questions. Return ONLY the JSON array.",
          },
        ],
      }),
    });

    const endTime = Date.now();

    if (!res.ok) {
      await trackApiCall({
        clientId,
        provider: "openrouter",
        model: "anthropic/claude-3-haiku",
        endpoint: "generate-questions",
        durationMs: endTime - startTime,
        success: false,
        errorMessage: `HTTP ${res.status}`,
      });
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    await trackApiCall({
      clientId,
      provider: "openrouter",
      model: "anthropic/claude-3-haiku",
      endpoint: "generate-questions",
      inputTokens: data.usage?.prompt_tokens || estimateTokens(contextPrompt),
      outputTokens: data.usage?.completion_tokens || estimateTokens(content),
      durationMs: endTime - startTime,
      success: true,
    });

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const questions = JSON.parse(jsonMatch[0]) as GeneratedQuestion[];
    console.log(`[Questions] Generated ${questions.length} custom questions for ${clientName}`);

    // Cache the generated questions
    if (clientId && questions.length > 0) {
      questionCache.set(clientId, { questions, timestamp: Date.now() });
      console.log(`[Questions] Cached questions for ${clientName}`);
    }

    return questions;
  } catch (error) {
    console.error("Failed to generate custom questions:", error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    let allInterviews;

    if (session.user.role === "admin") {
      // Admins see all interviews with client name
      allInterviews = await db
        .select({
          id: interviews.id,
          clientId: interviews.clientId,
          clientName: clients.name,
          mode: interviews.mode,
          status: interviews.status,
          title: interviews.title,
          questionsCount: interviews.questionsCount,
          extractionsCount: interviews.extractionsCount,
          startedAt: interviews.startedAt,
          completedAt: interviews.completedAt,
          createdAt: interviews.createdAt,
          transcript: interviews.transcript,
          recordingUrl: interviews.recordingUrl,
          questionsAsked: interviews.questionsAsked,
          shareToken: interviews.shareToken,
          shareTokenExpiresAt: interviews.shareTokenExpiresAt,
          sessionState: interviews.sessionState,
        })
        .from(interviews)
        .leftJoin(clients, eq(interviews.clientId, clients.id))
        .orderBy(desc(interviews.createdAt));
    } else {
      // Clients see their own interviews
      // First find the client record for this user
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
      });

      if (!client) {
        return NextResponse.json([]);
      }

      allInterviews = await db
        .select()
        .from(interviews)
        .where(eq(interviews.clientId, client.id))
        .orderBy(desc(interviews.createdAt));
    }

    return NextResponse.json(allInterviews);
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mode, clientId } = body;

    if (!mode || !["live_video", "text_chat"].includes(mode)) {
      return NextResponse.json(
        { error: "Valid mode is required (live_video or text_chat)" },
        { status: 400 }
      );
    }

    // Find or create client for this user
    let client = await db.query.clients.findFirst({
      where: eq(clients.userId, session.user.id),
    });

    // If client role and no client record, create one
    if (!client && session.user.role === "client") {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      const [newClient] = await db
        .insert(clients)
        .values({
          userId: session.user.id,
          name: user?.name || session.user.email?.split("@")[0] || "Unknown",
        })
        .returning();
      client = newClient;
    }

    // Get previously asked question IDs and content for this client
    let previouslyAskedQuestionIds: string[] = [];
    let coveredCategories: string[] = [];
    let previousInterviewContent: PreviousInterviewContent[] = [];

    if (client) {
      // Get ALL previous interviews (not just completed) to avoid repeating questions
      const previousInterviews = await db
        .select({
          questionsAsked: interviews.questionsAsked,
          title: interviews.title,
          status: interviews.status,
          createdAt: interviews.createdAt,
        })
        .from(interviews)
        .where(eq(interviews.clientId, client.id))
        .orderBy(desc(interviews.createdAt))
        .limit(10); // Get last 10 interviews for context

      // Extract all previously asked question IDs, categories, and FULL content
      previousInterviews.forEach((interview) => {
        const asked = interview.questionsAsked as Array<{
          questionId?: string;
          category?: string;
          question?: string;
          response?: string;
        }> || [];

        const keyInsights: string[] = [];
        const topicsDiscussed: string[] = [];

        asked.forEach((qa) => {
          if (qa.questionId) previouslyAskedQuestionIds.push(qa.questionId);
          if (qa.category) {
            coveredCategories.push(qa.category);
            topicsDiscussed.push(qa.category);
          }
          // Include FULL Q&A pair for context (not just snippets)
          if (qa.question && qa.response && qa.response.length > 30) {
            keyInsights.push(`Q: "${qa.question}" → A: "${qa.response}"`);
          }
        });

        if (keyInsights.length > 0) {
          previousInterviewContent.push({
            topic: interview.title || undefined,
            keyInsights: keyInsights, // Include ALL Q&As, not just top 3
            topicsDiscussed: [...new Set(topicsDiscussed)],
          });
        }
      });
    }

    // Get questions for the interview, excluding previously asked ones
    const baseConditions = [
      eq(questionBank.isActive, true),
      client ? eq(questionBank.clientId, client.id) : isNull(questionBank.clientId),
    ];

    // Add exclusion for previously asked questions if any exist
    if (previouslyAskedQuestionIds.length > 0) {
      baseConditions.push(notInArray(questionBank.id, previouslyAskedQuestionIds));
    }

    let questions = await db
      .select()
      .from(questionBank)
      .where(and(...baseConditions))
      .orderBy(sql`RANDOM()`)
      .limit(20);

    // If no client-specific questions (or all exhausted), get global ones
    if (questions.length === 0) {
      const globalConditions = [
        eq(questionBank.isActive, true),
        isNull(questionBank.clientId),
      ];

      if (previouslyAskedQuestionIds.length > 0) {
        globalConditions.push(notInArray(questionBank.id, previouslyAskedQuestionIds));
      }

      questions = await db
        .select()
        .from(questionBank)
        .where(and(...globalConditions))
        .orderBy(sql`RANDOM()`)
        .limit(20);
    }

    // If still no questions (all exhausted), allow repeats but prioritize least used
    if (questions.length === 0) {
      questions = await db
        .select()
        .from(questionBank)
        .where(
          and(eq(questionBank.isActive, true), isNull(questionBank.clientId))
        )
        .orderBy(questionBank.timesUsed)
        .limit(20);
    }

    // If STILL no questions (database is empty), create default starter questions
    if (questions.length === 0) {
      console.log("No questions found, inserting starter questions...");
      const starterQuestions = [
        {
          question: "Walk me through how you first got into your industry. What was the moment it clicked for you?",
          category: "origin_story" as const,
          difficulty: "easy" as const,
          topics: ["background", "career"],
          expectedClipPotential: 8,
          web2Friendly: true,
        },
        {
          question: "Tell me about a time you were completely wrong about something important. What did you learn?",
          category: "failure_story" as const,
          difficulty: "medium" as const,
          topics: ["lessons", "mistakes"],
          expectedClipPotential: 9,
          web2Friendly: true,
        },
        {
          question: "What do you believe about your industry that most people would strongly disagree with?",
          category: "hot_take" as const,
          difficulty: "medium" as const,
          topics: ["opinion", "industry"],
          expectedClipPotential: 10,
          web2Friendly: false,
        },
        {
          question: "What's your mental model or framework for making difficult decisions?",
          category: "framework" as const,
          difficulty: "deep" as const,
          topics: ["decision-making", "strategy"],
          expectedClipPotential: 8,
          web2Friendly: true,
        },
        {
          question: "What would you tell someone just starting out in your field that you wish you knew?",
          category: "advice" as const,
          difficulty: "easy" as const,
          topics: ["advice", "beginners"],
          expectedClipPotential: 8,
          web2Friendly: true,
        },
      ];

      const insertedQuestions = await db
        .insert(questionBank)
        .values(starterQuestions)
        .returning();

      questions = insertedQuestions;
      console.log(`Inserted ${questions.length} starter questions`);
    }

    // Get competitor topics to inform question prioritization
    let competitorTopics: string[] = [];
    if (client) {
      const clientCompetitors = await db
        .select({ topics: competitors.topics })
        .from(competitors)
        .where(eq(competitors.clientId, client.id));

      competitorTopics = clientCompetitors
        .flatMap((c) => c.topics || [])
        .filter((t) => t);
    }

    // Prepare client context for the session
    const kb = client?.knowledgeBase as KnowledgeBase | undefined;
    const clientKnowledgeSummary = kb ? {
      bio: kb.bio,
      products: kb.products,
      talkingPoints: kb.talkingPoints,
      voiceGuidelines: kb.voiceGuidelines,
      previousInsights: kb.insights,
      recentTweets: kb.typefullyTweets?.slice(0, 5).map(t => t.content),
    } : undefined;

    // Extract already asked question texts
    const alreadyAskedQuestionTexts = previousInterviewContent
      .flatMap(p => p.keyInsights)
      .map(insight => insight.split("→")[0]?.replace('Q: "', '').replace('"', '').trim())
      .filter(Boolean);

    // ============================================
    // SMART QUESTION SELECTION
    // ============================================
    // If we have rich context, generate custom questions
    // Otherwise, fall back to question bank
    // ============================================

    let sessionQuestions: Array<{ id?: string; question: string; category: string }> = [];
    let useCustomQuestions = false;

    if (client && hasRichContext(kb, previousInterviewContent, competitorTopics)) {
      console.log(`[Questions] Rich context found for ${client.name}, generating custom questions...`);

      const customQuestions = await generateCustomQuestions(
        client.name,
        kb,
        previousInterviewContent,
        competitorTopics,
        alreadyAskedQuestionTexts,
        client.id
      );

      if (customQuestions.length >= 8) {
        useCustomQuestions = true;
        sessionQuestions = customQuestions.map(q => ({
          question: q.question,
          category: q.category,
        }));

        // Mix in 2-3 questions from bank for variety (if available)
        if (questions.length > 0) {
          const bankMix = questions
            .slice(0, 3)
            .map(q => ({ id: q.id, question: q.question, category: q.category || "general" }));

          // Insert bank questions at positions 4, 8, 12 for variety
          bankMix.forEach((bq, i) => {
            const insertPos = Math.min((i + 1) * 4, sessionQuestions.length);
            sessionQuestions.splice(insertPos, 0, bq);
          });
        }

        console.log(`[Questions] Using ${customQuestions.length} custom + ${Math.min(3, questions.length)} bank questions`);
      }
    }

    // Fall back to question bank if no custom questions
    if (!useCustomQuestions) {
      console.log(`[Questions] Using question bank (no rich context or generation failed)`);

      // Prioritize categories not yet covered in previous interviews
      const uniqueCoveredCategories = [...new Set(coveredCategories)];
      let selectedQuestions = questions;

      if (questions.length > 5) {
        selectedQuestions = [...questions].sort((a, b) => {
          const aUncovered = !uniqueCoveredCategories.includes(a.category || "");
          const bUncovered = !uniqueCoveredCategories.includes(b.category || "");

          if (aUncovered && !bUncovered) return -1;
          if (!aUncovered && bUncovered) return 1;

          const aMatchesCompetitor = (a.topics || []).some((t) =>
            competitorTopics.some((ct) =>
              ct.toLowerCase().includes(t.toLowerCase()) ||
              t.toLowerCase().includes(ct.toLowerCase())
            )
          );
          const bMatchesCompetitor = (b.topics || []).some((t) =>
            competitorTopics.some((ct) =>
              ct.toLowerCase().includes(t.toLowerCase()) ||
              t.toLowerCase().includes(ct.toLowerCase())
            )
          );

          if (aMatchesCompetitor && !bMatchesCompetitor) return -1;
          if (!aMatchesCompetitor && bMatchesCompetitor) return 1;

          return 0;
        });
      }

      sessionQuestions = selectedQuestions.map(q => ({
        id: q.id,
        question: q.question,
        category: q.category || "general",
      }));
    }

    // Get the first question text for pre-generating audio
    const firstQuestion = sessionQuestions[0]?.question || "";

    // Pre-generate first question's audio in PARALLEL with DB insert (for instant playback)
    const [newInterview, firstQuestionAudio] = await Promise.all([
      db
        .insert(interviews)
        .values({
          clientId: client?.id || null,
          mode: mode as "live_video" | "text_chat",
          status: "in_progress",
          title: `Interview - ${new Date().toLocaleDateString()}`,
          startedAt: new Date(),
          questionsAsked: [],
          sessionState: {
            // Store full question objects (with or without IDs)
            questions: sessionQuestions,
            currentIndex: 0,
            useCustomQuestions,
            // Keep questionIds for backwards compatibility (only for bank questions)
            questionIds: sessionQuestions.filter(q => q.id).map(q => q.id),
            // Context for follow-ups
            clientContext: clientKnowledgeSummary,
            previousInterviews: previousInterviewContent.slice(0, 5),
            competitorTopics: competitorTopics.slice(0, 10),
            alreadyAskedQuestionTexts: alreadyAskedQuestionTexts.slice(0, 50),
          },
        })
        .returning()
        .then(result => result[0]),
      // Pre-generate audio for first question (runs in parallel)
      firstQuestion && elevenlabs.isConfigured()
        ? elevenlabs.textToSpeech(firstQuestion).then(buffer => {
            if (buffer) {
              const base64 = Buffer.from(buffer).toString("base64");
              return `data:audio/mpeg;base64,${base64}`;
            }
            return null;
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    console.log(`[Interview] Created with ${firstQuestionAudio ? "pre-generated" : "no"} audio`);

    // Return interview with pre-generated audio URL
    return NextResponse.json({
      ...newInterview,
      firstQuestionAudioUrl: firstQuestionAudio,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
