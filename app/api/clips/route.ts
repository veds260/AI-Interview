import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoClips, interviews, clients, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize R2 client for presigned URLs
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

const bucketName = process.env.R2_BUCKET_NAME || "ai-interview";

// Generate presigned URL for a video key
async function getPresignedVideoUrl(key: string): Promise<string> {
  // If it's already a full URL (legacy), extract the key
  if (key.startsWith("http")) {
    const urlParts = key.split("/");
    key = urlParts.slice(3).join("/"); // Extract path after domain
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // URL valid for 1 hour
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get("interviewId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let whereClause;

    // Filter based on user role
    if (session.user.role === "admin") {
      // Admins can see all clips
      whereClause = interviewId ? eq(videoClips.interviewId, interviewId) : undefined;
    } else if (session.user.role === "client") {
      // Clients can only see their own clips
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
        columns: { id: true },
      });

      if (!client) {
        return NextResponse.json({ clips: [] });
      }

      whereClause = interviewId
        ? and(eq(videoClips.interviewId, interviewId), eq(videoClips.clientId, client.id))
        : eq(videoClips.clientId, client.id);
    } else {
      // Writers can see clips from their assigned interviews
      return NextResponse.json({ clips: [] });
    }

    const clips = await db
      .select({
        id: videoClips.id,
        videoUrl: videoClips.videoUrl,
        thumbnailUrl: videoClips.thumbnailUrl,
        durationSeconds: videoClips.durationSeconds,
        fileSizeBytes: videoClips.fileSizeBytes,
        title: videoClips.title,
        description: videoClips.description,
        transcript: videoClips.transcript,
        createdAt: videoClips.createdAt,
        interviewId: videoClips.interviewId,
        clientId: videoClips.clientId,
        interviewTitle: interviews.title,
        clientName: clients.name,
      })
      .from(videoClips)
      .leftJoin(interviews, eq(videoClips.interviewId, interviews.id))
      .leftJoin(clients, eq(videoClips.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(videoClips.createdAt))
      .limit(limit);

    // Generate presigned URLs for each clip
    const clipsWithUrls = await Promise.all(
      clips.map(async (clip) => {
        try {
          const signedUrl = await getPresignedVideoUrl(clip.videoUrl);
          return { ...clip, videoUrl: signedUrl };
        } catch (e) {
          console.error(`Failed to sign URL for clip ${clip.id}:`, e);
          return clip; // Return original if signing fails
        }
      })
    );

    return NextResponse.json({ clips: clipsWithUrls });
  } catch (error) {
    console.error("Error fetching clips:", error);
    return NextResponse.json(
      { error: "Failed to fetch clips" },
      { status: 500 }
    );
  }
}
