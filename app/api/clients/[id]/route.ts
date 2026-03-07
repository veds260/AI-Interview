import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, interviews } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/clients/[id] - Get single client with related data
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

    const client = await db.query.clients.findFirst({
      where: eq(clients.id, id),
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const clientInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.clientId, id))
      .orderBy(desc(interviews.createdAt));

    return NextResponse.json({
      ...client,
      interviews: clientInterviews,
    });
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

// PATCH /api/clients/[id] - Update client (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!existingClient.length) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.brandName !== undefined) updateData.brandName = body.brandName;
    if (body.twitterHandle !== undefined) {
      updateData.twitterHandle = body.twitterHandle?.replace("@", "") || null;
    }
    if (body.telegramHandle !== undefined) updateData.telegramHandle = body.telegramHandle;
    if (body.linkedinUrl !== undefined) updateData.linkedinUrl = body.linkedinUrl;
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl;
    if (body.topicsOfExpertise !== undefined) updateData.topicsOfExpertise = body.topicsOfExpertise;
    if (body.voiceStyle !== undefined) updateData.voiceStyle = body.voiceStyle;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.knowledgeBase !== undefined) updateData.knowledgeBase = body.knowledgeBase;

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Delete client (admin only)
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
    await db.delete(clients).where(eq(clients.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
