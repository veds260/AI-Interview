import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeCompetitor } from "@/lib/services/twitter";

// POST /api/competitors/scrape - Scrape a competitor's Twitter (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { competitorId } = body;

    if (!competitorId) {
      return NextResponse.json(
        { error: "Competitor ID is required" },
        { status: 400 }
      );
    }

    // Get competitor
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    if (!competitor.twitterHandle) {
      return NextResponse.json(
        { error: "Competitor has no Twitter handle" },
        { status: 400 }
      );
    }

    console.log(`[Competitors] Manual scrape starting for @${competitor.twitterHandle}`);

    // Scrape Twitter
    const data = await scrapeCompetitor(competitor.twitterHandle);

    if (!data || !data.topics || data.topics.length === 0) {
      return NextResponse.json(
        { error: "Failed to scrape Twitter data. Check if API key is valid and handle exists." },
        { status: 500 }
      );
    }

    // Update competitor with scraped data
    await db
      .update(competitors)
      .set({
        topics: data.topics,
        avgEngagement: String(data.avgEngagement),
        lastScrapedAt: new Date(),
      })
      .where(eq(competitors.id, competitorId));

    console.log(`[Competitors] Scraped @${competitor.twitterHandle}: ${data.topics.length} topics, avg engagement: ${data.avgEngagement}`);

    return NextResponse.json({
      success: true,
      topics: data.topics,
      avgEngagement: data.avgEngagement,
      tweetCount: data.tweets.length,
    });
  } catch (error) {
    console.error("Error scraping competitor:", error);
    return NextResponse.json(
      { error: "Failed to scrape competitor" },
      { status: 500 }
    );
  }
}
