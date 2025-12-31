import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeCompetitor } from "@/lib/services/twitter";

// POST /api/competitors/[id]/scrape - Scrape competitor Twitter data
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get competitor
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, id),
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

    // Scrape Twitter data
    const data = await scrapeCompetitor(competitor.twitterHandle);

    if (!data) {
      return NextResponse.json(
        { error: "Failed to scrape Twitter data. Check API key or handle." },
        { status: 500 }
      );
    }

    // Update competitor with scraped data
    await db
      .update(competitors)
      .set({
        avgEngagement: data.avgEngagement,
        topics: data.topics,
        lastScrapedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, id));

    return NextResponse.json({
      success: true,
      data: {
        avgEngagement: data.avgEngagement,
        topics: data.topics,
        followerCount: data.followerCount,
        topTweets: data.topTweets.map((t) => ({
          text: t.text,
          engagement: t.engagement,
          likes: t.public_metrics.like_count,
          retweets: t.public_metrics.retweet_count,
        })),
      },
    });
  } catch (error) {
    console.error("Error scraping competitor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
