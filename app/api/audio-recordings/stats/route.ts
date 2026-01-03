import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewMessages } from "@/lib/db/schema";
import { isNotNull, count } from "drizzle-orm";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

const bucketName = process.env.R2_BUCKET_NAME || "ai-interview";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Count total recordings
    const [countResult] = await db
      .select({ count: count() })
      .from(interviewMessages)
      .where(isNotNull(interviewMessages.audioUrl));

    const totalRecordings = countResult?.count || 0;

    // Get all audio URLs to calculate total size
    const recordings = await db
      .select({ audioUrl: interviewMessages.audioUrl })
      .from(interviewMessages)
      .where(isNotNull(interviewMessages.audioUrl))
      .limit(500);

    // Calculate total size (sample first 100 for performance)
    let totalBytes = 0;
    const sampled = recordings.slice(0, 100);

    for (const recording of sampled) {
      try {
        let key = recording.audioUrl!;
        if (key.startsWith("http")) {
          const urlParts = key.split("/");
          key = urlParts.slice(3).join("/");
        }

        const command = new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        const response = await r2Client.send(command);
        totalBytes += response.ContentLength || 0;
      } catch {
        // Skip files that don't exist
      }
    }

    // Extrapolate if we sampled
    if (recordings.length > sampled.length) {
      const avgSize = totalBytes / sampled.length;
      totalBytes = avgSize * recordings.length;
    }

    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;

    return NextResponse.json({
      totalRecordings,
      totalBytes: Math.round(totalBytes),
      totalMB: Math.round(totalMB * 100) / 100,
      totalGB: Math.round(totalGB * 100) / 100,
    });
  } catch (error) {
    console.error("Error fetching audio stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
