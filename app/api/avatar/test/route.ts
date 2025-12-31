import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.SIMLI_API_KEY;
    const faceId = process.env.SIMLI_FACE_ID;

    if (!apiKey || !faceId) {
      return NextResponse.json({
        success: false,
        error: "Missing Simli credentials",
        hasApiKey: !!apiKey,
        hasFaceId: !!faceId,
      });
    }

    // Test the Simli API by calling startAudioToVideoSession
    const res = await fetch("https://api.simli.ai/startAudioToVideoSession", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        faceId: faceId,
        apiKey: apiKey,
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      response: data,
      credentials: {
        apiKeyLength: apiKey.length,
        faceId: faceId,
      },
    });
  } catch (error) {
    console.error("Simli test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
