import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients, questionBank, users } from "@/lib/db";
import { desc, eq, and, isNull, notInArray } from "drizzle-orm";
import { trackApiCall, estimateTokens } from "@/lib/utils/api-tracker";

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

// Disable question cache - always generate fresh to avoid repetition
const questionCache = new Map<string, { questions: GeneratedQuestion[]; timestamp: number }>();
const CACHE_TTL_MS = 0;

// Safe JSON parser with error recovery for AI-generated JSON
function safeParseJSON(jsonString: string): GeneratedQuestion[] | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    // Continue to fixes
  }

  let fixed = jsonString;

  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  fixed = fixed.replace(/"([^"]*?)"/g, (match, content) => {
    if (!content.includes('"')) return match;
    const escaped = content.replace(/(?<!\\)"/g, '\\"');
    return `"${escaped}"`;
  });

  const startBracket = fixed.indexOf('[');
  const endBracket = fixed.lastIndexOf(']');
  if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
    fixed = fixed.substring(startBracket, endBracket + 1);
  }

  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;

  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }

  try {
    return JSON.parse(fixed);
  } catch {
    // Continue to more aggressive fixes
  }

  try {
    const questionPattern = /\{\s*"question"\s*:\s*"[^"]+"\s*,\s*"category"\s*:\s*"[^"]+"\s*(?:,\s*"reasoning"\s*:\s*"[^"]*")?\s*\}/g;
    const matches = fixed.match(questionPattern);
    if (matches && matches.length > 0) {
      const questions = matches.map(m => {
        try {
          return JSON.parse(m);
        } catch {
          return null;
        }
      }).filter(Boolean);
      if (questions.length > 0) {
        console.log(`[Questions] Recovered ${questions.length} questions from malformed JSON`);
        return questions as GeneratedQuestion[];
      }
    }
  } catch {
    // Give up
  }

  return null;
}

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

  if (clientId) {
    const cached = questionCache.get(clientId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Questions] Using cached questions for ${clientName} (${cached.questions.length} questions)`);
      return cached.questions;
    }
  }

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

  if (competitorTopics.length > 0) {
    contextPrompt += `=== TRENDING TOPICS IN THEIR SPACE ===\n${competitorTopics.slice(0, 10).join(", ")}\n\n`;
  }

  const coveredThemes: string[] = [];
  if (previousInterviews.length > 0 || alreadyAskedQuestions.length > 0) {
    contextPrompt += `=== TOPICS/THEMES ALREADY COVERED (DO NOT ASK ABOUT THESE AGAIN) ===\n`;
    contextPrompt += `These topics have been discussed. Ask about COMPLETELY DIFFERENT things:\n`;

    previousInterviews.slice(0, 3).forEach((interview) => {
      interview.keyInsights.slice(0, 5).forEach(insight => {
        const qMatch = insight.match(/Q: "([^"]+)"/);
        if (qMatch) {
          contextPrompt += `- ${qMatch[1]}\n`;
          coveredThemes.push(qMatch[1]);
        }
      });
    });

    alreadyAskedQuestions.slice(0, 15).forEach(q => {
      if (!coveredThemes.includes(q)) {
        contextPrompt += `- ${q}\n`;
      }
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
            content: `You generate interview questions based ONLY on facts explicitly provided.

CRITICAL - NO HALLUCINATION:
- ONLY reference things EXPLICITLY stated in the context below
- If bio says "writer", do NOT assume they run an "agency" or "company"
- If they mention "crypto", do NOT assume "fundraising" or "investors"
- NEVER infer or assume roles, companies, strategies, or facts not stated
- When in doubt, ask OPEN questions that let THEM define their work

CRITICAL - NO REPETITION:
- "What's your biggest failure?" and "Tell me about a time you failed" are THE SAME
- Each question must be on a COMPLETELY DIFFERENT topic

GOOD OPEN QUESTIONS (when context is limited):
- "What's been the most surprising part of your journey so far?"
- "What do most people misunderstand about what you do?"
- "What's a belief you hold that others in your space would disagree with?"
- "What's something you've changed your mind about recently?"
- "If you could go back 5 years, what advice would you give yourself?"

Return JSON array with 10-12 questions:
[{"question": "...", "category": "origin_story|failure_story|hot_take|lessons|prediction|tactical", "reasoning": "what EXPLICIT fact this references"}]`,
          },
          {
            role: "user",
            content: contextPrompt + "\n\nGenerate 12-15 interview questions. Each must cover a DIFFERENT topic/theme than the ones already covered above. Return ONLY the JSON array.",
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

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[Questions] No JSON array found in response for ${clientName}, retrying...`);
      return retryQuestionGeneration(apiKey, contextPrompt, clientName, clientId);
    }

    const questions = safeParseJSON(jsonMatch[0]);
    if (!questions || questions.length === 0) {
      console.error(`[Questions] Failed to parse JSON for ${clientName}, retrying...`);
      console.error(`[Questions] Raw response:`, content.substring(0, 500));
      return retryQuestionGeneration(apiKey, contextPrompt, clientName, clientId);
    }
    console.log(`[Questions] Generated ${questions.length} custom questions for ${clientName}`);

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

async function retryQuestionGeneration(
  apiKey: string,
  contextPrompt: string,
  clientName: string,
  clientId?: string
): Promise<GeneratedQuestion[]> {
  console.log(`[Questions] Retry attempt for ${clientName}`);

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
            content: `You generate interview questions. Return ONLY valid JSON, no other text.

CRITICAL JSON RULES:
- Start response with [ and end with ]
- No trailing commas
- Escape quotes inside strings with \\"
- No text before or after the JSON array

Format: [{"question": "text here", "category": "origin_story"}]
Valid categories: origin_story, failure_story, hot_take, lessons, prediction, tactical`,
          },
          {
            role: "user",
            content: contextPrompt + "\n\nGenerate exactly 10 interview questions. Return ONLY the JSON array, nothing else. Start with [ and end with ].",
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`[Questions] Retry failed with HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    await trackApiCall({
      clientId,
      provider: "openrouter",
      model: "anthropic/claude-3-haiku",
      endpoint: "generate-questions-retry",
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      durationMs: 0,
      success: true,
    });

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[Questions] Retry: No JSON array found`);
      return [];
    }

    const questions = safeParseJSON(jsonMatch[0]);
    if (!questions || questions.length === 0) {
      console.error(`[Questions] Retry: Still failed to parse JSON`);
      return [];
    }

    console.log(`[Questions] Retry successful: ${questions.length} questions for ${clientName}`);

    if (clientId && questions.length > 0) {
      questionCache.set(clientId, { questions, timestamp: Date.now() });
    }

    return questions;
  } catch (error) {
    console.error(`[Questions] Retry error:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allInterviews = await db
      .select({
        id: interviews.id,
        clientId: interviews.clientId,
        clientName: clients.name,
        mode: interviews.mode,
        status: interviews.status,
        title: interviews.title,
        questionsCount: interviews.questionsCount,
        startedAt: interviews.startedAt,
        completedAt: interviews.completedAt,
        createdAt: interviews.createdAt,
        transcript: interviews.transcript,
        transcriptMarkdown: interviews.transcriptMarkdown,
        questionsAsked: interviews.questionsAsked,
        shareToken: interviews.shareToken,
        shareTokenExpiresAt: interviews.shareTokenExpiresAt,
        sessionState: interviews.sessionState,
      })
      .from(interviews)
      .leftJoin(clients, eq(interviews.clientId, clients.id))
      .orderBy(desc(interviews.createdAt));

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

    // Find client if specified
    let client = clientId
      ? await db.query.clients.findFirst({ where: eq(clients.id, clientId) })
      : null;

    // Get previously asked question IDs and content for this client
    let previouslyAskedQuestionIds: string[] = [];
    let coveredCategories: string[] = [];
    let previousInterviewContent: PreviousInterviewContent[] = [];

    if (client) {
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
        .limit(200);

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
          if (qa.question && qa.response && qa.response.length > 30) {
            keyInsights.push(`Q: "${qa.question}" → A: "${qa.response}"`);
          }
        });

        if (keyInsights.length > 0) {
          previousInterviewContent.push({
            topic: interview.title || undefined,
            keyInsights,
            topicsDiscussed: [...new Set(topicsDiscussed)],
          });
        }
      });
    }

    // Collect ALL previously asked question texts (for text-based deduplication)
    const allPreviouslyAskedTexts = new Set<string>();
    previousInterviewContent.forEach(interview => {
      interview.keyInsights.forEach(insight => {
        const qMatch = insight.match(/Q: "([^"]+)"/);
        if (qMatch) {
          allPreviouslyAskedTexts.add(qMatch[1].toLowerCase().trim().replace(/[?!.,]/g, ''));
        }
      });
    });
    console.log(`[Questions] Found ${allPreviouslyAskedTexts.size} previously asked question texts to exclude`);

    // Get questions for the interview, excluding previously asked ones
    const baseConditions = [
      eq(questionBank.isActive, true),
      client ? eq(questionBank.clientId, client.id) : isNull(questionBank.clientId),
    ];

    if (previouslyAskedQuestionIds.length > 0) {
      baseConditions.push(notInArray(questionBank.id, previouslyAskedQuestionIds));
    }

    let questions = await db
      .select()
      .from(questionBank)
      .where(and(...baseConditions))
      .orderBy(desc(questionBank.createdAt))
      .limit(40);

    questions = questions.filter(q => {
      const normalizedQ = q.question.toLowerCase().trim().replace(/[?!.,]/g, '');
      return !allPreviouslyAskedTexts.has(normalizedQ);
    }).slice(0, 20);

    // If no client-specific questions, get global ones
    if (questions.length === 0) {
      const globalConditions = [
        eq(questionBank.isActive, true),
        isNull(questionBank.clientId),
      ];

      if (previouslyAskedQuestionIds.length > 0) {
        globalConditions.push(notInArray(questionBank.id, previouslyAskedQuestionIds));
      }

      let globalQuestions = await db
        .select()
        .from(questionBank)
        .where(and(...globalConditions))
        .orderBy(desc(questionBank.createdAt))
        .limit(40);

      questions = globalQuestions.filter(q => {
        const normalizedQ = q.question.toLowerCase().trim().replace(/[?!.,]/g, '');
        return !allPreviouslyAskedTexts.has(normalizedQ);
      }).slice(0, 20);
    }

    // If still no questions, use open-ended fallbacks
    if (questions.length === 0) {
      console.log("[Questions] All unique questions exhausted - using open fallbacks");
      const fallbackQuestions = [
        {
          id: undefined,
          question: "What's been on your mind lately that you haven't had a chance to talk about?",
          category: "lessons" as const,
          difficulty: "easy" as const,
          topics: ["general"],
          expectedClipPotential: 8,
          web2Friendly: true,
          isActive: true,
          clientId: null,
          timesUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: undefined,
          question: "What's something most people misunderstand about what you do?",
          category: "hot_take" as const,
          difficulty: "easy" as const,
          topics: ["perception"],
          expectedClipPotential: 9,
          web2Friendly: true,
          isActive: true,
          clientId: null,
          timesUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: undefined,
          question: "What's a question you wish more people would ask you?",
          category: "values" as const,
          difficulty: "easy" as const,
          topics: ["reflection"],
          expectedClipPotential: 8,
          web2Friendly: true,
          isActive: true,
          clientId: null,
          timesUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: undefined,
          question: "What's the most counterintuitive lesson you've learned in your work?",
          category: "lessons" as const,
          difficulty: "medium" as const,
          topics: ["insights"],
          expectedClipPotential: 9,
          web2Friendly: true,
          isActive: true,
          clientId: null,
          timesUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      questions = fallbackQuestions as any;
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

    const alreadyAskedQuestionTexts = previousInterviewContent
      .flatMap(p => p.keyInsights)
      .map(insight => insight.split("→")[0]?.replace('Q: "', '').replace('"', '').trim())
      .filter(Boolean);

    // Smart question selection: generate custom if rich context, else use bank
    let sessionQuestions: Array<{ id?: string; question: string; category: string }> = [];
    let useCustomQuestions = false;
    const competitorTopics: string[] = [];

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

        if (questions.length > 0) {
          const bankMix = questions
            .slice(0, 3)
            .map(q => ({ id: q.id, question: q.question, category: q.category || "general" }));

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

      const uniqueCoveredCategories = [...new Set(coveredCategories)];
      let selectedQuestions = questions;

      if (questions.length > 5) {
        selectedQuestions = [...questions].sort((a, b) => {
          const aUncovered = !uniqueCoveredCategories.includes(a.category || "");
          const bUncovered = !uniqueCoveredCategories.includes(b.category || "");

          if (aUncovered && !bUncovered) return -1;
          if (!aUncovered && bUncovered) return 1;

          return 0;
        });
      }

      sessionQuestions = selectedQuestions.map(q => ({
        id: q.id,
        question: q.question,
        category: q.category || "general",
      }));
    }

    const [newInterview] = await db
      .insert(interviews)
      .values({
        clientId: client?.id || null,
        mode: mode as "live_video" | "text_chat",
        status: "in_progress",
        title: `Interview - ${new Date().toLocaleDateString()}`,
        startedAt: new Date(),
        questionsAsked: [],
        sessionState: {
          questions: sessionQuestions,
          currentIndex: 0,
          useCustomQuestions,
          questionIds: sessionQuestions.filter(q => q.id).map(q => q.id),
          clientContext: clientKnowledgeSummary,
          previousInterviews: previousInterviewContent.slice(0, 5),
          competitorTopics: competitorTopics.slice(0, 10),
          alreadyAskedQuestionTexts: alreadyAskedQuestionTexts.slice(0, 50),
        },
      })
      .returning();

    return NextResponse.json(newInterview, { status: 201 });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
