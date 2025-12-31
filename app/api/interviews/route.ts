import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients, questionBank, users } from "@/lib/db";
import { desc, eq, and, isNull } from "drizzle-orm";

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

    // Get questions for the interview (global questions or client-specific)
    const questions = await db
      .select()
      .from(questionBank)
      .where(
        and(
          eq(questionBank.isActive, true),
          client
            ? eq(questionBank.clientId, client.id)
            : isNull(questionBank.clientId)
        )
      )
      .limit(20);

    // If no client-specific questions, get global ones
    let selectedQuestions = questions;
    if (questions.length === 0) {
      selectedQuestions = await db
        .select()
        .from(questionBank)
        .where(
          and(eq(questionBank.isActive, true), isNull(questionBank.clientId))
        )
        .limit(20);
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
