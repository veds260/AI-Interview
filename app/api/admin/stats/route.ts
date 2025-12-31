import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, interviews, contentExtractions, questionBank } from "@/lib/db/schema";
import { eq, count, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get total clients
    const clientsResult = await db
      .select({ count: count() })
      .from(clients)
      .where(eq(clients.isActive, true));

    // Get interview stats
    const interviewStats = await db
      .select({
        status: interviews.status,
        count: count(),
      })
      .from(interviews)
      .groupBy(interviews.status);

    const interviewCounts = {
      total: 0,
      completed: 0,
      inProgress: 0,
    };

    interviewStats.forEach((stat) => {
      interviewCounts.total += stat.count;
      if (stat.status === "completed") {
        interviewCounts.completed = stat.count;
      } else if (stat.status === "in_progress" || stat.status === "paused") {
        interviewCounts.inProgress += stat.count;
      }
    });

    // Get extraction stats
    const extractionStats = await db
      .select({
        status: contentExtractions.status,
        count: count(),
      })
      .from(contentExtractions)
      .groupBy(contentExtractions.status);

    const extractionCounts = {
      total: 0,
      extracted: 0,
      assigned: 0,
      used: 0,
    };

    extractionStats.forEach((stat) => {
      extractionCounts.total += stat.count;
      if (stat.status === "extracted") {
        extractionCounts.extracted = stat.count;
      } else if (stat.status === "assigned") {
        extractionCounts.assigned = stat.count;
      } else if (stat.status === "used") {
        extractionCounts.used = stat.count;
      }
    });

    // Get question bank count
    const questionsResult = await db
      .select({ count: count() })
      .from(questionBank)
      .where(eq(questionBank.isActive, true));

    // Get recent interviews with client names
    const recentInterviews = await db
      .select({
        id: interviews.id,
        title: interviews.title,
        status: interviews.status,
        createdAt: interviews.createdAt,
        clientName: clients.name,
      })
      .from(interviews)
      .leftJoin(clients, eq(interviews.clientId, clients.id))
      .orderBy(desc(interviews.createdAt))
      .limit(5);

    return NextResponse.json({
      clients: clientsResult[0]?.count || 0,
      interviews: interviewCounts,
      extractions: extractionCounts,
      questions: questionsResult[0]?.count || 0,
      recentInterviews: recentInterviews.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        clientName: i.clientName,
        createdAt: i.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
