import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoClips, interviews, clients } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get("interviewId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let whereClause;

    // Filter based on user role
    if (session.user.role === "admin") {
      // Admins can see all clips
      whereClause = interviewId ? eq(videoClips.interviewId, interviewId) : undefined;
    } else if (session.user.role === "client") {
      // Clients can only see their own clips
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
        columns: { id: true },
      });

      if (!client) {
        return NextResponse.json({ clips: [] });
      }

      whereClause = interviewId
        ? and(eq(videoClips.interviewId, interviewId), eq(videoClips.clientId, client.id))
        : eq(videoClips.clientId, client.id);
    } else {
      // Writers can see clips from their assigned interviews
      return NextResponse.json({ clips: [] });
    }

    const clips = await db
      .select({
        id: videoClips.id,
        videoUrl: videoClips.videoUrl,
        thumbnailUrl: videoClips.thumbnailUrl,
        durationSeconds: videoClips.durationSeconds,
        fileSizeBytes: videoClips.fileSizeBytes,
        title: videoClips.title,
        description: videoClips.description,
        transcript: videoClips.transcript,
        createdAt: videoClips.createdAt,
        interviewId: videoClips.interviewId,
        interviewTitle: interviews.title,
      })
      .from(videoClips)
      .leftJoin(interviews, eq(videoClips.interviewId, interviews.id))
      .where(whereClause)
      .orderBy(desc(videoClips.createdAt))
      .limit(limit);

    return NextResponse.json({ clips });
  } catch (error) {
    console.error("Error fetching clips:", error);
    return NextResponse.json(
      { error: "Failed to fetch clips" },
      { status: 500 }
    );
  }
}
