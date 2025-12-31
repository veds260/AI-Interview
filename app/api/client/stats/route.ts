import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, interviews, contentExtractions } from "@/lib/db/schema";
import { eq, count, desc, and } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the client record for this user
    const client = await db.query.clients.findFirst({
      where: eq(clients.userId, session.user.id),
    });

    if (!client) {
      // Return zeros if no client record exists
      return NextResponse.json({
        completed: 0,
        inProgress: 0,
        contentGenerated: 0,
        recentInterviews: [],
      });
    }

    // Get interview stats for this client
    const interviewStats = await db
      .select({
        status: interviews.status,
        count: count(),
      })
      .from(interviews)
      .where(eq(interviews.clientId, client.id))
      .groupBy(interviews.status);

    let completed = 0;
    let inProgress = 0;

    interviewStats.forEach((stat) => {
      if (stat.status === "completed") {
        completed = stat.count;
      } else if (stat.status === "in_progress" || stat.status === "paused") {
        inProgress += stat.count;
      }
    });

    // Get content extractions count for this client
    const extractionsResult = await db
      .select({ count: count() })
      .from(contentExtractions)
      .where(eq(contentExtractions.clientId, client.id));

    // Get recent interviews
    const recentInterviews = await db
      .select({
        id: interviews.id,
        title: interviews.title,
        status: interviews.status,
        createdAt: interviews.createdAt,
        mode: interviews.mode,
      })
      .from(interviews)
      .where(eq(interviews.clientId, client.id))
      .orderBy(desc(interviews.createdAt))
      .limit(5);

    return NextResponse.json({
      completed,
      inProgress,
      contentGenerated: extractionsResult[0]?.count || 0,
      recentInterviews: recentInterviews.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        mode: i.mode,
        createdAt: i.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching client stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
