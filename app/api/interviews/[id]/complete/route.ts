import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients } from "@/lib/db";
import { eq } from "drizzle-orm";

interface KnowledgeBase {
  bio?: string;
  products?: string[];
  talkingPoints?: string[];
  voiceGuidelines?: string;
  notes?: string;
  interviewInsights?: Array<{
    date: string;
    insights: string[];
    topics: string[];
  }>;
}

// Extract insights from interview using AI
async function extractInsights(
  questionsAsked: Array<{ question: string; response: string; category?: string }>
): Promise<{ insights: string[]; topics: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || questionsAsked.length === 0) {
    return { insights: [], topics: [] };
  }

  try {
    const transcript = questionsAsked
      .map((qa) => `Q: ${qa.question}\nA: ${qa.response}`)
      .join("\n\n");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: `You analyze interview transcripts to extract key insights about the interviewee.
Extract:
1. Key biographical facts and experiences
2. Core beliefs and values
3. Unique perspectives and hot takes
4. Areas of expertise
5. Communication style traits

Return JSON only:
{
  "insights": ["insight 1", "insight 2", ...],
  "topics": ["topic1", "topic2", ...]
}`,
          },
          {
            role: "user",
            content: `Extract key insights from this interview:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!res.ok) return { insights: [], topics: [] };

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insights: parsed.insights || [],
        topics: parsed.topics || [],
      };
    }
  } catch (error) {
    console.error("Failed to extract insights:", error);
  }

  return { insights: [], topics: [] };
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

    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Calculate total duration
    const startTime = interview.startedAt
      ? new Date(interview.startedAt).getTime()
      : Date.now();
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    await db
      .update(interviews)
      .set({
        status: "completed",
        completedAt: new Date(),
        totalDurationSeconds: durationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    // Extract insights from interview and update client knowledge base
    if (interview.clientId && interview.questionsAsked) {
      const questionsAsked = interview.questionsAsked as Array<{
        question: string;
        response: string;
        category?: string;
      }>;

      const { insights, topics } = await extractInsights(questionsAsked);

      if (insights.length > 0 || topics.length > 0) {
        // Get current client knowledge base
        const client = await db.query.clients.findFirst({
          where: eq(clients.id, interview.clientId),
        });

        if (client) {
          const currentKb = (client.knowledgeBase as KnowledgeBase) || {};
          const interviewInsights = currentKb.interviewInsights || [];

          // Add new insights
          interviewInsights.push({
            date: new Date().toISOString(),
            insights,
            topics,
          });

          // Update client knowledge base
          await db
            .update(clients)
            .set({
              knowledgeBase: {
                ...currentKb,
                interviewInsights,
              },
              // Also update topics of expertise if we found new ones
              topicsOfExpertise: [
                ...new Set([
                  ...(client.topicsOfExpertise || []),
                  ...topics.slice(0, 5),
                ]),
              ],
              updatedAt: new Date(),
            })
            .where(eq(clients.id, interview.clientId));
        }
      }
    }

    // TODO: Trigger content extraction job here

    return NextResponse.json({
      success: true,
      message: "Interview completed",
    });
  } catch (error) {
    console.error("Error completing interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
