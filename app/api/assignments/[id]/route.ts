import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewAssignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/assignments/[id] - Get single assignment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [assignment] = await db
      .select()
      .from(interviewAssignments)
      .where(eq(interviewAssignments.id, id))
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check access
    if (
      session.user.role === "writer" &&
      assignment.writerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

// PATCH /api/assignments/[id] - Update assignment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const [existingAssignment] = await db
      .select()
      .from(interviewAssignments)
      .where(eq(interviewAssignments.id, id))
      .limit(1);

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check access (writer can only update their own, admin can update any)
    if (
      session.user.role === "writer" &&
      existingAssignment.writerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};

    if (body.status) {
      updateData.status = body.status;
      if (body.status === "completed") {
        updateData.completedAt = new Date();
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.contentProduced !== undefined) {
      updateData.contentProduced = body.contentProduced;
    }

    const [updated] = await db
      .update(interviewAssignments)
      .set(updateData)
      .where(eq(interviewAssignments.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE /api/assignments/[id] - Delete assignment (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await db
      .delete(interviewAssignments)
      .where(eq(interviewAssignments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
