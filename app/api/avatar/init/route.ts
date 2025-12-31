import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.SIMLI_API_KEY;
    const faceId = process.env.SIMLI_FACE_ID;

    console.log("Simli config:", {
      hasApiKey: !!apiKey,
      hasFaceId: !!faceId,
      apiKeyLength: apiKey?.length,
      faceId: faceId
    });

    if (!apiKey || !faceId) {
      return NextResponse.json({
        mock: true,
        message: "Using mock avatar (Simli not configured)",
      });
    }

    // Return credentials for client-side SimliClient initialization
    return NextResponse.json({
      mock: false,
      apiKey,
      faceId,
    });
  } catch (error) {
    console.error("Error initializing avatar:", error);
    return NextResponse.json({
      mock: true,
      error: "Failed to initialize avatar",
    });
  }
}
