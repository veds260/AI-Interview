import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitors, clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/competitors - Get all competitors (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    let whereClause;
    if (clientId) {
      whereClause = eq(competitors.clientId, clientId);
    }

    const allCompetitors = await db
      .select({
        competitor: competitors,
        client: clients,
      })
      .from(competitors)
      .leftJoin(clients, eq(competitors.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(competitors.createdAt));

    const result = allCompetitors.map((item) => ({
      id: item.competitor.id,
      clientId: item.competitor.clientId,
      twitterHandle: item.competitor.twitterHandle,
      name: item.competitor.name,
      topics: item.competitor.topics,
      avgEngagement: item.competitor.avgEngagement,
      lastScrapedAt: item.competitor.lastScrapedAt,
      createdAt: item.competitor.createdAt,
      client: item.client ? {
        id: item.client.id,
        name: item.client.name,
        brandName: item.client.brandName,
      } : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitors" },
      { status: 500 }
    );
  }
}

// POST /api/competitors - Create new competitor (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { clientId, twitterHandle, name, topics } = body;

    if (!clientId || !twitterHandle) {
      return NextResponse.json(
        { error: "Client ID and Twitter handle are required" },
        { status: 400 }
      );
    }

    // Check if client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client.length) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Create competitor
    const [competitor] = await db
      .insert(competitors)
      .values({
        clientId,
        twitterHandle: twitterHandle.replace("@", ""),
        name,
        topics: topics || [],
      })
      .returning();

    return NextResponse.json(competitor);
  } catch (error) {
    console.error("Error creating competitor:", error);
    return NextResponse.json(
      { error: "Failed to create competitor" },
      { status: 500 }
    );
  }
}
