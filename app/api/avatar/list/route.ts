import { NextResponse } from "next/server";
import { heygen } from "@/lib/services/heygen";

export async function GET() {
  try {
    if (!heygen.isConfigured()) {
      return NextResponse.json({ error: "HeyGen not configured" }, { status: 400 });
    }

    const avatars = await heygen.listStreamingAvatars();

    return NextResponse.json({
      count: avatars?.length || 0,
      avatars: avatars?.slice(0, 20), // Return first 20
    });
  } catch (error) {
    console.error("Error listing avatars:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
