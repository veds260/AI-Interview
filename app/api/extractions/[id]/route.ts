import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentExtractions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/extractions/[id] - Get single extraction
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

    const extraction = await db.query.contentExtractions.findFirst({
      where: eq(contentExtractions.id, id),
    });

    if (!extraction) {
      return NextResponse.json(
        { error: "Extraction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(extraction);
  } catch (error) {
    console.error("Error fetching extraction:", error);
    return NextResponse.json(
      { error: "Failed to fetch extraction" },
      { status: 500 }
    );
  }
}

// PATCH /api/extractions/[id] - Update extraction (edit drafts)
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

    // Check if extraction exists
    const existing = await db
      .select()
      .from(contentExtractions)
      .where(eq(contentExtractions.id, id))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Extraction not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};

    // Editable fields
    if (body.tweetDraft !== undefined) updateData.tweetDraft = body.tweetDraft;
    if (body.linkedinDraft !== undefined) updateData.linkedinDraft = body.linkedinDraft;
    if (body.threadOutline !== undefined) updateData.threadOutline = body.threadOutline;
    if (body.keyQuote !== undefined) updateData.keyQuote = body.keyQuote;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.usedIn !== undefined) updateData.usedIn = body.usedIn;

    const [updated] = await db
      .update(contentExtractions)
      .set(updateData)
      .where(eq(contentExtractions.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating extraction:", error);
    return NextResponse.json(
      { error: "Failed to update extraction" },
      { status: 500 }
    );
  }
}

// DELETE /api/extractions/[id] - Delete extraction (admin only)
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

    await db.delete(contentExtractions).where(eq(contentExtractions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extraction:", error);
    return NextResponse.json(
      { error: "Failed to delete extraction" },
      { status: 500 }
    );
  }
}
