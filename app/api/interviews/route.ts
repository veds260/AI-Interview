import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients, questionBank, users, competitors } from "@/lib/db";
import { desc, eq, and, isNull, notInArray, sql } from "drizzle-orm";

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
      // Admins see all interviews
      allInterviews = await db
        .select()
        .from(interviews)
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

    // Get previously asked question IDs for this client
    let previouslyAskedQuestionIds: string[] = [];
    let coveredCategories: string[] = [];

    if (client) {
      const previousInterviews = await db
        .select({ questionsAsked: interviews.questionsAsked })
        .from(interviews)
        .where(
          and(
            eq(interviews.clientId, client.id),
            eq(interviews.status, "completed")
          )
        );

      // Extract all previously asked question IDs and categories
      previousInterviews.forEach((interview) => {
        const asked = interview.questionsAsked as Array<{ questionId?: string; category?: string }> || [];
        asked.forEach((qa) => {
          if (qa.questionId) previouslyAskedQuestionIds.push(qa.questionId);
          if (qa.category) coveredCategories.push(qa.category);
        });
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

    // Prioritize categories not yet covered in previous interviews
    const uniqueCoveredCategories = [...new Set(coveredCategories)];
    let selectedQuestions = questions;

    if (questions.length > 5) {
      // Sort to prioritize:
      // 1. Uncovered categories first
      // 2. Questions related to competitor topics (trending content)
      selectedQuestions = [...questions].sort((a, b) => {
        const aUncovered = !uniqueCoveredCategories.includes(a.category || "");
        const bUncovered = !uniqueCoveredCategories.includes(b.category || "");

        // First priority: uncovered categories
        if (aUncovered && !bUncovered) return -1;
        if (!aUncovered && bUncovered) return 1;

        // Second priority: questions matching competitor topics
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

    // Create the interview
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
          questionIds: selectedQuestions.map((q) => q.id),
          currentIndex: 0,
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
