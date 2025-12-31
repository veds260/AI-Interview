import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, contentExtractions } from "@/lib/db";
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

    const [updated] = await db
      .update(contentExtractions)
      .set({
        status: "used",
      })
      .where(eq(contentExtractions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Extraction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error marking extraction as used:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
