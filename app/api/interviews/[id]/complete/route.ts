import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients } from "@/lib/db";
import { eq } from "drizzle-orm";

// Generate clean markdown transcript from Q&A pairs
function generateTranscriptMarkdown(
  questionsAsked: Array<{ question: string; response: string; category?: string; isFollowUp?: boolean }>,
  clientName: string | null,
  interviewDate: Date,
  mode: string,
  guestName: string | null,
  durationSeconds: number | null
): string {
  const date = interviewDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const displayMode = mode === "live_video" ? "Audio" : "Text";
  const name = guestName || clientName || "Unknown";

  let md = `# Interview Transcript\n\n`;
  md += `**Interviewee:** ${name}\n`;
  md += `**Date:** ${date}\n`;
  md += `**Mode:** ${displayMode}\n`;
  if (durationSeconds) {
    const mins = Math.floor(durationSeconds / 60);
    md += `**Duration:** ${mins} minute${mins !== 1 ? "s" : ""}\n`;
  }
  md += `**Questions answered:** ${questionsAsked.length}\n`;
  md += `\n---\n\n`;

  questionsAsked.forEach((qa, i) => {
    const label = qa.isFollowUp ? `Follow-up` : `Q${i + 1}`;
    md += `## ${label}: ${qa.question}\n\n`;
    md += `${qa.response}\n\n`;
  });

  return md;
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

    // Get client name for transcript
    let clientName: string | null = null;
    if (interview.clientId) {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, interview.clientId),
      });
      clientName = client?.name || null;
    }

    // Generate markdown transcript
    const questionsAsked = (interview.questionsAsked as Array<{
      question: string;
      response: string;
      category?: string;
      isFollowUp?: boolean;
    }>) || [];

    const transcriptMarkdown = generateTranscriptMarkdown(
      questionsAsked,
      clientName,
      new Date(),
      interview.mode,
      interview.guestName,
      durationSeconds
    );

    await db
      .update(interviews)
      .set({
        status: "completed",
        completedAt: new Date(),
        totalDurationSeconds: durationSeconds,
        transcriptMarkdown,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    return NextResponse.json({
      success: true,
      message: "Interview completed",
      transcriptMarkdown,
    });
  } catch (error) {
    console.error("Error completing interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
