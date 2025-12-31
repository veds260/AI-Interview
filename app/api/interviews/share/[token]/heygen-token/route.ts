import { NextResponse } from "next/server";
import { db, interviews } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";
import { heygen } from "@/lib/services/heygen";

// Get HeyGen token for public shared interview (no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate share token
    const interview = await db.query.interviews.findFirst({
      where: and(
        eq(interviews.shareToken, token),
        gt(interviews.shareTokenExpiresAt, new Date())
      ),
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Only provide token for video interviews
    if (interview.mode !== "live_video") {
      return NextResponse.json({
        error: "Video not enabled for this interview",
        configured: false,
      });
    }

    if (!heygen.isConfigured()) {
      return NextResponse.json({
        error: "Video not configured",
        configured: false,
      });
    }

    const heygenToken = await heygen.createAccessToken();

    if (!heygenToken) {
      return NextResponse.json({
        error: "Failed to create access token",
        configured: true,
      });
    }

    return NextResponse.json({
      token: heygenToken,
      configured: true,
    });
  } catch (error) {
    console.error("Error getting HeyGen token for shared interview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
