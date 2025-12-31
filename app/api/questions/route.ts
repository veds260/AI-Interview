import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, questionBank } from "@/lib/db";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questions = await db
      .select()
      .from(questionBank)
      .orderBy(desc(questionBank.createdAt));

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      category,
      difficulty,
      topics,
      expectedClipPotential,
      web2Friendly,
      clientId,
    } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const [newQuestion] = await db
      .insert(questionBank)
      .values({
        question,
        category: category || null,
        difficulty: difficulty || "medium",
        topics: topics || [],
        expectedClipPotential: expectedClipPotential || 5,
        web2Friendly: web2Friendly || false,
        clientId: clientId || null,
      })
      .returning();

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
