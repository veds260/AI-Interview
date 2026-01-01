import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoClips } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get total storage used and clip count
    const result = await db
      .select({
        totalClips: sql<number>`count(*)`,
        totalBytes: sql<number>`coalesce(sum(${videoClips.fileSizeBytes}), 0)`,
      })
      .from(videoClips);

    const stats = result[0];
    const totalBytes = Number(stats.totalBytes) || 0;
    const totalClips = Number(stats.totalClips) || 0;

    // R2 free tier limit
    const freeLimit = 10 * 1024 * 1024 * 1024; // 10 GB in bytes
    const usagePercent = (totalBytes / freeLimit) * 100;

    return NextResponse.json({
      totalClips,
      totalBytes,
      totalMB: Math.round(totalBytes / (1024 * 1024) * 100) / 100,
      totalGB: Math.round(totalBytes / (1024 * 1024 * 1024) * 1000) / 1000,
      freeLimit,
      freeLimitGB: 10,
      usagePercent: Math.round(usagePercent * 100) / 100,
      remainingGB: Math.round((freeLimit - totalBytes) / (1024 * 1024 * 1024) * 1000) / 1000,
    });
  } catch (error) {
    console.error("Error fetching storage stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
