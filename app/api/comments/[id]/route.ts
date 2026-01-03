import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PUT /api/comments/[id] - Toggle resolved status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get current comment
    const [existingComment] = await db
      .select()
      .from(postComments)
      .where(eq(postComments.id, id))
      .limit(1);

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Toggle resolved status
    const [updatedComment] = await db
      .update(postComments)
      .set({
        resolved: !existingComment.resolved,
        updatedAt: new Date(),
      })
      .where(eq(postComments.id, id))
      .returning();

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/comments/[id] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    // Get comment
    const [existingComment] = await db
      .select()
      .from(postComments)
      .where(eq(postComments.id, id))
      .limit(1);

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if user owns the comment or is admin
    const userRole = (session?.user as { role?: string })?.role;
    if (existingComment.userId !== session?.user?.id && userRole !== "admin") {
      return NextResponse.json(
        { error: "Not authorized to delete this comment" },
        { status: 403 }
      );
    }

    await db.delete(postComments).where(eq(postComments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
