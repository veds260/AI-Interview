import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// DELETE /api/competitors/[id] - Delete competitor (admin only)
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

    await db.delete(competitors).where(eq(competitors.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting competitor:", error);
    return NextResponse.json(
      { error: "Failed to delete competitor" },
      { status: 500 }
    );
  }
}
