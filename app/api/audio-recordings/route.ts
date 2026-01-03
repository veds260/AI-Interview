import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewMessages, interviews, clients, interviewAssignments } from "@/lib/db/schema";
import { eq, desc, and, isNotNull, inArray } from "drizzle-orm";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
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

// Generate presigned URL for an audio key
async function getPresignedAudioUrl(key: string): Promise<string> {
  if (key.startsWith("http")) {
    const urlParts = key.split("/");
    key = urlParts.slice(3).join("/");
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

// Get file size from R2
async function getFileSize(key: string): Promise<number | null> {
  try {
    if (key.startsWith("http")) {
      const urlParts = key.split("/");
      key = urlParts.slice(3).join("/");
    }

    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);
    return response.ContentLength || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get("interviewId");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Base condition: only messages with audio
    let conditions = [isNotNull(interviewMessages.audioUrl)];

    // Filter based on user role
    if (session.user.role === "admin") {
      if (interviewId) {
        conditions.push(eq(interviewMessages.interviewId, interviewId));
      }
    } else if (session.user.role === "client") {
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
        columns: { id: true },
      });

      if (!client) {
        return NextResponse.json({ recordings: [] });
      }

      // Get interviews belonging to this client
      if (interviewId) {
        conditions.push(eq(interviewMessages.interviewId, interviewId));
      }
      // We'll filter by client via the join
    } else if (session.user.role === "writer") {
      // Writers can only access audio from their assigned interviews
      const assignments = await db
        .select({ interviewId: interviewAssignments.interviewId })
        .from(interviewAssignments)
        .where(eq(interviewAssignments.writerId, session.user.id));

      const assignedInterviewIds = assignments.map((a) => a.interviewId);

      if (assignedInterviewIds.length === 0) {
        return NextResponse.json({ recordings: [] });
      }

      if (interviewId) {
        // Verify writer has access to this interview
        if (!assignedInterviewIds.includes(interviewId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        conditions.push(eq(interviewMessages.interviewId, interviewId));
      } else {
        conditions.push(inArray(interviewMessages.interviewId, assignedInterviewIds));
      }
    } else {
      return NextResponse.json({ recordings: [] });
    }

    const recordings = await db
      .select({
        id: interviewMessages.id,
        audioUrl: interviewMessages.audioUrl,
        content: interviewMessages.content,
        role: interviewMessages.role,
        createdAt: interviewMessages.createdAt,
        interviewId: interviewMessages.interviewId,
        interviewTitle: interviews.title,
        clientId: interviews.clientId,
        clientName: clients.name,
      })
      .from(interviewMessages)
      .innerJoin(interviews, eq(interviewMessages.interviewId, interviews.id))
      .leftJoin(clients, eq(interviews.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(interviewMessages.createdAt))
      .limit(limit);

    // Filter by client for non-admin users
    let filteredRecordings = recordings;
    if (session.user.role === "client") {
      const client = await db.query.clients.findFirst({
        where: eq(clients.userId, session.user.id),
        columns: { id: true },
      });
      if (client) {
        filteredRecordings = recordings.filter((r) => r.clientId === client.id);
      }
    }

    // Generate presigned URLs and get file sizes
    const recordingsWithUrls = await Promise.all(
      filteredRecordings.map(async (recording) => {
        try {
          const signedUrl = await getPresignedAudioUrl(recording.audioUrl!);
          const fileSize = await getFileSize(recording.audioUrl!);
          return {
            ...recording,
            audioUrl: signedUrl,
            fileSizeBytes: fileSize,
          };
        } catch (e) {
          console.error(`Failed to process recording ${recording.id}:`, e);
          return { ...recording, fileSizeBytes: null };
        }
      })
    );

    return NextResponse.json({ recordings: recordingsWithUrls });
  } catch (error) {
    console.error("Error fetching audio recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio recordings" },
      { status: 500 }
    );
  }
}
