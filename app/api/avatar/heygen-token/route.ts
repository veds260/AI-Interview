import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { heygen } from "@/lib/services/heygen";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!heygen.isConfigured()) {
      return NextResponse.json({
        error: "HeyGen not configured",
        configured: false,
      });
    }

    const token = await heygen.createAccessToken();

    if (!token) {
      return NextResponse.json({
        error: "Failed to create access token",
        configured: true,
      });
    }

    return NextResponse.json({
      token,
      configured: true,
    });
  } catch (error) {
    console.error("Error getting HeyGen token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
