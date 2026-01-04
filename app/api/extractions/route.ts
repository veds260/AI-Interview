import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, contentExtractions, interviews, clients } from "@/lib/db";
import { desc, eq, and, inArray } from "drizzle-orm";
import { claude } from "@/lib/services/claude";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get("type");
    const status = searchParams.get("status");
    let clientId = searchParams.get("clientId");

    // For client users, automatically filter to only their own content
    if (session.user.role === "client") {
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
      });
      if (client) {
        clientId = client.id;
      } else {
        // No client record found, return empty
        return NextResponse.json([]);
      }
    }

    // Build where conditions
    const conditions = [];

    if (contentType) {
      conditions.push(
        eq(
          contentExtractions.contentType,
          contentType as typeof contentExtractions.$inferSelect.contentType
        )
      );
    }

    if (status) {
      conditions.push(
        eq(
          contentExtractions.status,
          status as typeof contentExtractions.$inferSelect.status
        )
      );
    }

    if (clientId) {
      conditions.push(eq(contentExtractions.clientId, clientId));
    }

    const interviewId = searchParams.get("interviewId");
    if (interviewId) {
      conditions.push(eq(contentExtractions.interviewId, interviewId));
    }

    // Join with clients and interviews to get names
    const extractions = await db
      .select({
        id: contentExtractions.id,
        interviewId: contentExtractions.interviewId,
        clientId: contentExtractions.clientId,
        contentType: contentExtractions.contentType,
        topics: contentExtractions.topics,
        questionAsked: contentExtractions.questionAsked,
        rawResponse: contentExtractions.rawResponse,
        keyQuote: contentExtractions.keyQuote,
        summary: contentExtractions.summary,
        tweetDraft: contentExtractions.tweetDraft,
        linkedinDraft: contentExtractions.linkedinDraft,
        threadOutline: contentExtractions.threadOutline,
        suggestedFormats: contentExtractions.suggestedFormats,
        status: contentExtractions.status,
        web2Friendly: contentExtractions.web2Friendly,
        technicalDepth: contentExtractions.technicalDepth,
        controversyLevel: contentExtractions.controversyLevel,
        storytellingPotential: contentExtractions.storytellingPotential,
        createdAt: contentExtractions.createdAt,
        clientName: clients.name,
        clientTwitterHandle: clients.twitterHandle,
        clientProfilePicture: clients.profilePicture,
        interviewTitle: interviews.title,
      })
      .from(contentExtractions)
      .leftJoin(clients, eq(contentExtractions.clientId, clients.id))
      .leftJoin(interviews, eq(contentExtractions.interviewId, interviews.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentExtractions.createdAt));

    return NextResponse.json(extractions);
  } catch (error) {
    console.error("Error fetching extractions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Process an interview and extract content
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "writer"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = await request.json();

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    // Get interview with questions/responses
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, interviewId),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get client info for context - including full knowledge base
    let clientContext: {
      name?: string;
      topics?: string[];
      voiceStyle?: string;
      bio?: string;
      products?: string[];
      talkingPoints?: string[];
      competitorTopics?: string[];
      otherQAs?: { question: string; response: string }[];
    } | undefined;

    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });

      if (client) {
        const kb = client.knowledgeBase as {
          bio?: string;
          products?: string[];
          talkingPoints?: string[];
          voiceGuidelines?: string;
        } | null;

        // Get competitor topics
        const { competitors } = await import("@/lib/db/schema");
        const clientCompetitors = await db
          .select({ topics: competitors.topics })
          .from(competitors)
          .where(eq(competitors.clientId, client.id));

        const competitorTopics = clientCompetitors
          .flatMap((c) => c.topics || [])
          .filter((t) => t);

        clientContext = {
          name: client.name,
          topics: client.topicsOfExpertise || [],
          voiceStyle: client.voiceStyle || kb?.voiceGuidelines || undefined,
          bio: kb?.bio || undefined,
          products: kb?.products || undefined,
          talkingPoints: kb?.talkingPoints || undefined,
          competitorTopics: competitorTopics.length > 0 ? competitorTopics : undefined,
        };
      }
    }

    const questionsAsked = (interview.questionsAsked as { question: string; response: string; category?: string }[]) || [];
    const extractedContent = [];

    // Valid content types from the enum
    const VALID_CONTENT_TYPES = [
      "origin_story", "failure_story", "success_story", "turning_point",
      "hot_take", "contrarian_view", "industry_critique", "prediction",
      "technical", "framework", "how_to", "lessons", "values", "habits",
      "influences", "advice"
    ];

    // Process each Q&A pair with full context
    for (let i = 0; i < questionsAsked.length; i++) {
      const qa = questionsAsked[i];
      if (!qa.question || !qa.response) continue;

      // Skip very short responses (likely not useful content)
      if (qa.response.length < 50) {
        console.log(`Skipping short response (${qa.response.length} chars)`);
        continue;
      }

      // Include other Q&As from the same interview as context (excluding current one)
      const otherQAs = questionsAsked
        .filter((_, idx) => idx !== i && questionsAsked[idx].response?.length > 50)
        .map(q => ({ question: q.question, response: q.response }));

      const extraction = await claude.extractContent(
        qa.question,
        qa.response,
        clientContext ? { ...clientContext, otherQAs } : undefined
      );

      if (extraction) {
        // Validate contentType - skip if invalid (AI returned something like "insufficient_data")
        if (!VALID_CONTENT_TYPES.includes(extraction.contentType)) {
          console.log(`Skipping invalid contentType: ${extraction.contentType}`);
          continue;
        }

        // Skip if tweet draft is empty or indicates insufficient content
        if (!extraction.tweetDraft ||
            extraction.tweetDraft.toLowerCase().includes("not enough content") ||
            extraction.tweetDraft.toLowerCase().includes("insufficient") ||
            extraction.tweetDraft.toLowerCase().includes("unable to generate")) {
          console.log(`Skipping extraction with invalid tweet draft`);
          continue;
        }

        try {
          const [saved] = await db
            .insert(contentExtractions)
            .values({
              interviewId: interview.id,
              clientId: interview.clientId,
              contentType: extraction.contentType as typeof contentExtractions.$inferInsert.contentType,
              topics: extraction.topics,
              questionAsked: qa.question,
              rawResponse: qa.response,
              keyQuote: extraction.keyQuote,
              summary: extraction.summary,
              tweetDraft: extraction.tweetDraft,
              threadOutline: extraction.threadOutline,
              linkedinDraft: extraction.linkedinDraft,
              suggestedFormats: extraction.suggestedFormats,
              web2Friendly: extraction.web2Friendly,
              technicalDepth: extraction.technicalDepth,
              controversyLevel: extraction.controversyLevel,
              storytellingPotential: extraction.storytellingPotential,
            })
            .returning();

          extractedContent.push(saved);
        } catch (insertError) {
          console.error("Failed to insert extraction:", insertError);
          // Continue with other extractions
        }
      }
    }

    // Update interview extraction count and mark as completed
    await db
      .update(interviews)
      .set({
        extractionsCount: extractedContent.length,
        status: "completed",
        completedAt: interview.completedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId));

    return NextResponse.json({
      message: `Extracted ${extractedContent.length} content pieces`,
      count: extractedContent.length,
      extractions: extractedContent,
    });
  } catch (error) {
    console.error("Error extracting content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
