import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { interviewMessages } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";

async function listAllAudioFiles(): Promise<Array<{ key: string; interviewId: string; timestamp: number }>> {
  const audioFiles: Array<{ key: string; interviewId: string; timestamp: number }> = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: "audio/",
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);

    for (const obj of response.Contents || []) {
      if (!obj.Key) continue;

      // Parse key: audio/{interviewId}/{timestamp}-{randomId}.webm
      const match = obj.Key.match(/^audio\/([^/]+)\/(\d+)-[^.]+\.\w+$/);
      if (match) {
        audioFiles.push({
          key: obj.Key,
          interviewId: match[1],
          timestamp: parseInt(match[2], 10),
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return audioFiles;
}

export async function POST() {
  try {
    const session = await auth();

    // Only admin can run backfill
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check R2 config
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY) {
      return NextResponse.json(
        { error: "R2 not configured" },
        { status: 500 }
      );
    }

    // List all audio files in R2
    const audioFiles = await listAllAudioFiles();

    if (audioFiles.length === 0) {
      return NextResponse.json({
        message: "No audio files found in R2",
        matched: 0,
        noMatch: 0,
      });
    }

    // Group by interviewId
    const byInterview = new Map<string, typeof audioFiles>();
    for (const file of audioFiles) {
      const existing = byInterview.get(file.interviewId) || [];
      existing.push(file);
      byInterview.set(file.interviewId, existing);
    }

    let matched = 0;
    let noMatch = 0;
    const details: string[] = [];

    // Process each interview
    for (const [interviewId, files] of byInterview) {
      // Sort files by timestamp
      files.sort((a, b) => a.timestamp - b.timestamp);

      // Get all client messages for this interview without audioUrl
      const messages = await db
        .select()
        .from(interviewMessages)
        .where(
          and(
            eq(interviewMessages.interviewId, interviewId),
            eq(interviewMessages.role, "client"),
            isNull(interviewMessages.audioUrl)
          )
        )
        .orderBy(interviewMessages.createdAt);

      if (messages.length === 0) continue;

      // Match files to messages by timestamp proximity
      for (const file of files) {
        let bestMatch: typeof messages[0] | null = null;
        let bestDiff = Infinity;

        for (const msg of messages) {
          const msgTime = new Date(msg.createdAt!).getTime();
          const diff = Math.abs(msgTime - file.timestamp);

          // Within 30 seconds
          if (diff < 30000 && diff < bestDiff) {
            bestDiff = diff;
            bestMatch = msg;
          }
        }

        if (bestMatch) {
          // Update the message with audioUrl
          await db
            .update(interviewMessages)
            .set({ audioUrl: file.key })
            .where(eq(interviewMessages.id, bestMatch.id));

          details.push(`Linked ${file.key} to message ${bestMatch.id}`);
          matched++;

          // Remove from messages array to avoid double-matching
          const idx = messages.indexOf(bestMatch);
          if (idx > -1) messages.splice(idx, 1);
        } else {
          noMatch++;
        }
      }
    }

    return NextResponse.json({
      message: "Backfill complete",
      totalAudioFiles: audioFiles.length,
      interviews: byInterview.size,
      matched,
      noMatch,
      details: details.slice(0, 20), // First 20 for debugging
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Backfill failed", details: String(error) },
      { status: 500 }
    );
  }
}
