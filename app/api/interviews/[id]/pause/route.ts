import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews } from "@/lib/db";
import { eq } from "drizzle-orm";

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

    await db
      .update(interviews)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    return NextResponse.json({
      success: true,
      message: "Interview paused",
    });
  } catch (error) {
    console.error("Error pausing interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
