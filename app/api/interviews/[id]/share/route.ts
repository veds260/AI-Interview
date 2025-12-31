import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

// Generate a shareable link for an interview
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
    const { expiresInDays = 7 } = await request.json().catch(() => ({}));

    // Check if interview exists
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Generate a secure token
    const shareToken = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Update interview with share token
    await db
      .update(interviews)
      .set({
        shareToken,
        shareTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    // Generate the shareable URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/shared/${shareToken}`;

    return NextResponse.json({
      shareUrl,
      shareToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error generating share link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Revoke shareable link
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await db
      .update(interviews)
      .set({
        shareToken: null,
        shareTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
