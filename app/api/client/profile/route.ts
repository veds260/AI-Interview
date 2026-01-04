import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/client/profile - Get current client's profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await db.query.clients.findFirst({
      where: eq(clients.userId, session.user.id),
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/client/profile - Update current client's profile
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Find the client
    const client = await db.query.clients.findFirst({
      where: eq(clients.userId, session.user.id),
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build update object with allowed fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.brandName !== undefined) updateData.brandName = body.brandName;
    if (body.profilePicture !== undefined) updateData.profilePicture = body.profilePicture;
    if (body.twitterHandle !== undefined) updateData.twitterHandle = body.twitterHandle;
    if (body.linkedinUrl !== undefined) updateData.linkedinUrl = body.linkedinUrl;
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl;

    // Handle knowledge base updates (merge with existing)
    if (body.bio !== undefined || body.topics !== undefined) {
      const existingKb = (client.knowledgeBase as Record<string, unknown>) || {};
      updateData.knowledgeBase = {
        ...existingKb,
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.topics !== undefined && { talkingPoints: body.topics.split(",").map((t: string) => t.trim()).filter(Boolean) }),
      };
    }

    if (body.topicsOfExpertise !== undefined) {
      updateData.topicsOfExpertise = body.topicsOfExpertise.split(",").map((t: string) => t.trim()).filter(Boolean);
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, client.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating client profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
