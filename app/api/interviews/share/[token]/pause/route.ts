import { NextResponse } from "next/server";
import { db, interviews } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";

// Pause a shared interview (no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const interview = await db.query.interviews.findFirst({
      where: and(
        eq(interviews.shareToken, token),
        gt(interviews.shareTokenExpiresAt, new Date())
      ),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    if (interview.status !== "in_progress") {
      return NextResponse.json(
        { error: "Interview is not in progress" },
        { status: 400 }
      );
    }

    await db
      .update(interviews)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interview.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error pausing shared interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
