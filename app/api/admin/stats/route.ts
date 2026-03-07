import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, interviews, questionBank } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [clientsResult, interviewStats, questionsResult, recentInterviews] = await Promise.all([
      db.select({ count: count() }).from(clients).where(eq(clients.isActive, true)),
      db.select({ status: interviews.status, count: count() }).from(interviews).groupBy(interviews.status),
      db.select({ count: count() }).from(questionBank).where(eq(questionBank.isActive, true)),
      db.select({
        id: interviews.id,
        title: interviews.title,
        status: interviews.status,
        createdAt: interviews.createdAt,
        clientName: clients.name,
      })
        .from(interviews)
        .leftJoin(clients, eq(interviews.clientId, clients.id))
        .orderBy(desc(interviews.createdAt))
        .limit(5),
    ]);

    const interviewCounts = { total: 0, completed: 0, inProgress: 0 };
    interviewStats.forEach((stat) => {
      interviewCounts.total += stat.count;
      if (stat.status === "completed") interviewCounts.completed = stat.count;
      else if (stat.status === "in_progress" || stat.status === "paused") interviewCounts.inProgress += stat.count;
    });

    return NextResponse.json({
      clients: clientsResult[0]?.count || 0,
      interviews: interviewCounts,
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
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
