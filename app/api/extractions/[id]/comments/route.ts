import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postComments, contentExtractions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/extractions/[id]/comments - Get all comments for an extraction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify extraction exists
    const extraction = await db
      .select()
      .from(contentExtractions)
      .where(eq(contentExtractions.id, id))
      .limit(1);

    if (extraction.length === 0) {
      return NextResponse.json(
        { error: "Extraction not found" },
        { status: 404 }
      );
    }

    const comments = await db
      .select()
      .from(postComments)
      .where(eq(postComments.extractionId, id))
      .orderBy(postComments.createdAt);

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/extractions/[id]/comments - Add a comment to an extraction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const body = await request.json();

    const { commentText, selectedText, startOffset, endOffset, userName, userRole } = body;

    if (!commentText?.trim()) {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
    }

    // Verify extraction exists
    const extraction = await db
      .select()
      .from(contentExtractions)
      .where(eq(contentExtractions.id, id))
      .limit(1);

    if (extraction.length === 0) {
      return NextResponse.json(
        { error: "Extraction not found" },
        { status: 404 }
      );
    }

    // Get user info
    const userId = session?.user?.id || null;
    const finalUserName = userName || session?.user?.name || "Anonymous";
    const finalUserRole = userRole || (session?.user as { role?: string })?.role || "writer";

    const [newComment] = await db
      .insert(postComments)
      .values({
        extractionId: id,
        userId,
        userName: finalUserName,
        userRole: finalUserRole,
        commentText: commentText.trim(),
        selectedText: selectedText || null,
        startOffset: startOffset ?? null,
        endOffset: endOffset ?? null,
        resolved: false,
      })
      .returning();

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
