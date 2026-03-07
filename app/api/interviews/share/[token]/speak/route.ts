import { NextResponse } from "next/server";
import { db, interviews } from "@/lib/db";
import { eq, gt, and } from "drizzle-orm";
import { elevenlabs } from "@/lib/services/elevenlabs";

// Convert question text to speech audio (no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { text } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Verify valid share token
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

    if (!elevenlabs.isConfigured()) {
      return NextResponse.json(
        { error: "Audio not available" },
        { status: 503 }
      );
    }

    const buffer = await elevenlabs.textToSpeech(text.trim());
    if (!buffer) {
      return NextResponse.json(
        { error: "Failed to generate audio" },
        { status: 500 }
      );
    }

    const base64 = Buffer.from(buffer).toString("base64");
    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64}`,
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
