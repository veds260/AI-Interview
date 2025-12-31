import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewAssignments, contentExtractions, interviews, clients } from "@/lib/db/schema";
import { eq, count, desc, and, gte } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get assignment stats for this writer
    const assignmentStats = await db
      .select({
        status: interviewAssignments.status,
        count: count(),
      })
      .from(interviewAssignments)
      .where(eq(interviewAssignments.writerId, session.user.id))
      .groupBy(interviewAssignments.status);

    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    assignmentStats.forEach((stat) => {
      if (stat.status === "pending") {
        pending = stat.count;
      } else if (stat.status === "in_progress") {
        inProgress = stat.count;
      } else if (stat.status === "completed") {
        completed = stat.count;
      }
    });

    // Get completed assignments this month
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedThisMonthResult = await db
      .select({ count: count() })
      .from(interviewAssignments)
      .where(
        and(
          eq(interviewAssignments.writerId, session.user.id),
          eq(interviewAssignments.status, "completed"),
          gte(interviewAssignments.completedAt, firstOfMonth)
        )
      );

    // Get content bank count (all available extractions)
    const contentBankResult = await db
      .select({ count: count() })
      .from(contentExtractions)
      .where(eq(contentExtractions.status, "extracted"));

    // Get recent assignments with client info
    const recentAssignments = await db
      .select({
        id: interviewAssignments.id,
        status: interviewAssignments.status,
        assignedAt: interviewAssignments.assignedAt,
        interviewId: interviewAssignments.interviewId,
        interviewTitle: interviews.title,
        clientName: clients.name,
      })
      .from(interviewAssignments)
      .leftJoin(interviews, eq(interviewAssignments.interviewId, interviews.id))
      .leftJoin(clients, eq(interviews.clientId, clients.id))
      .where(eq(interviewAssignments.writerId, session.user.id))
      .orderBy(desc(interviewAssignments.assignedAt))
      .limit(5);

    return NextResponse.json({
      pending,
      inProgress,
      completed,
      completedThisMonth: completedThisMonthResult[0]?.count || 0,
      contentBank: contentBankResult[0]?.count || 0,
      recentAssignments: recentAssignments.map((a) => ({
        id: a.id,
        status: a.status,
        assignedAt: a.assignedAt?.toISOString(),
        interviewId: a.interviewId,
        interviewTitle: a.interviewTitle,
        clientName: a.clientName,
      })),
    });
  } catch (error) {
    console.error("Error fetching writer stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
