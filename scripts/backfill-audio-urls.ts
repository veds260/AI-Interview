/**
 * Backfill script to link existing R2 audio files to interviewMessages
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/backfill-audio-urls.ts
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import * as schema from "../lib/db/schema";

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

async function backfill() {
  console.log("Starting audio URL backfill...\n");

  // Check R2 config
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY) {
    console.error("R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY");
    process.exit(1);
  }

  // Connect to database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // List all audio files in R2
  console.log("Scanning R2 for audio files...");
  const audioFiles = await listAllAudioFiles();
  console.log(`Found ${audioFiles.length} audio files in R2\n`);

  if (audioFiles.length === 0) {
    console.log("No audio files found. Nothing to backfill.");
    await client.end();
    return;
  }

  // Group by interviewId
  const byInterview = new Map<string, typeof audioFiles>();
  for (const file of audioFiles) {
    const existing = byInterview.get(file.interviewId) || [];
    existing.push(file);
    byInterview.set(file.interviewId, existing);
  }

  console.log(`Audio files span ${byInterview.size} interviews\n`);

  let matched = 0;
  let alreadyLinked = 0;
  let noMatch = 0;

  // Process each interview
  for (const [interviewId, files] of byInterview) {
    // Sort files by timestamp
    files.sort((a, b) => a.timestamp - b.timestamp);

    // Get all client messages for this interview without audioUrl
    const messages = await db
      .select()
      .from(schema.interviewMessages)
      .where(
        and(
          eq(schema.interviewMessages.interviewId, interviewId),
          eq(schema.interviewMessages.role, "client"),
          isNull(schema.interviewMessages.audioUrl)
        )
      )
      .orderBy(schema.interviewMessages.createdAt);

    if (messages.length === 0) {
      // Check if already linked
      const linkedMessages = await db
        .select()
        .from(schema.interviewMessages)
        .where(
          and(
            eq(schema.interviewMessages.interviewId, interviewId),
            eq(schema.interviewMessages.role, "client")
          )
        );

      if (linkedMessages.some(m => m.audioUrl)) {
        alreadyLinked += files.length;
        continue;
      }
    }

    console.log(`Interview ${interviewId}: ${files.length} audio files, ${messages.length} unlinked messages`);

    // Match files to messages by timestamp proximity
    for (const file of files) {
      const fileTime = new Date(file.timestamp);

      // Find message with closest createdAt (within 30 seconds)
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
          .update(schema.interviewMessages)
          .set({ audioUrl: file.key })
          .where(eq(schema.interviewMessages.id, bestMatch.id));

        console.log(`  ✓ Linked ${file.key} to message ${bestMatch.id} (${Math.round(bestDiff / 1000)}s diff)`);
        matched++;

        // Remove from messages array to avoid double-matching
        const idx = messages.indexOf(bestMatch);
        if (idx > -1) messages.splice(idx, 1);
      } else {
        console.log(`  ✗ No match for ${file.key} (timestamp: ${fileTime.toISOString()})`);
        noMatch++;
      }
    }
  }

  console.log("\n=== Backfill Complete ===");
  console.log(`Matched: ${matched}`);
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`No match found: ${noMatch}`);

  await client.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
