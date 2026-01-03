import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { interviewMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Initialize R2 client (lazy - only when needed)
let r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY) {
    return null;
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY || "",
        secretAccessKey: process.env.R2_SECRET_KEY || "",
      },
    });
  }

  return r2Client;
}

export function isStorageConfigured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY);
}

/**
 * Upload audio file to R2 storage in background (non-blocking)
 * Returns immediately, upload happens async
 */
export function uploadAudioInBackground(
  audioBuffer: ArrayBuffer,
  options: {
    interviewId: string;
    messageId?: string;
    contentType?: string;
  }
): void {
  const client = getR2Client();
  if (!client) {
    console.log("[Storage] R2 not configured, skipping audio upload");
    return;
  }

  // Fire and forget - don't await
  uploadAudioToR2(client, audioBuffer, options).catch((err) => {
    console.error("[Storage] Background audio upload failed:", err);
  });
}

/**
 * Upload audio with a pre-defined key (for when we need to return the key before upload completes)
 */
export function uploadAudioInBackgroundWithKey(
  audioBuffer: ArrayBuffer,
  key: string,
  contentType: string = "audio/webm"
): void {
  const client = getR2Client();
  if (!client) {
    console.log("[Storage] R2 not configured, skipping audio upload");
    return;
  }

  const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";

  // Fire and forget
  client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(audioBuffer),
      ContentType: contentType,
    })
  ).then(() => {
    console.log("[Storage] Audio uploaded:", key, `(${Math.round(Buffer.from(audioBuffer).length / 1024)}KB)`);
  }).catch((err) => {
    console.error("[Storage] Background audio upload failed:", err);
  });
}

/**
 * Internal function to handle the actual upload
 */
async function uploadAudioToR2(
  client: S3Client,
  audioBuffer: ArrayBuffer,
  options: {
    interviewId: string;
    messageId?: string;
    contentType?: string;
  }
): Promise<string> {
  const { interviewId, messageId, contentType = "audio/webm" } = options;

  // Generate unique filename
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const extension = contentType.includes("mp3") ? "mp3" : contentType.includes("wav") ? "wav" : "webm";
  const filename = `audio/${interviewId}/${timestamp}-${randomId}.${extension}`;

  const buffer = Buffer.from(audioBuffer);
  const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";

  // Upload to R2
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    })
  );

  console.log("[Storage] Audio uploaded:", filename, `(${Math.round(buffer.length / 1024)}KB)`);

  // Update message with audio URL if messageId provided
  if (messageId) {
    try {
      await db
        .update(interviewMessages)
        .set({ audioUrl: filename })
        .where(eq(interviewMessages.id, messageId));
      console.log("[Storage] Updated message audioUrl:", messageId);
    } catch (dbError) {
      console.error("[Storage] Failed to update message audioUrl:", dbError);
    }
  }

  return filename;
}

/**
 * Upload audio synchronously (blocks until complete)
 * Use when you need the URL immediately
 */
export async function uploadAudio(
  audioBuffer: ArrayBuffer,
  options: {
    interviewId: string;
    messageId?: string;
    contentType?: string;
  }
): Promise<string | null> {
  const client = getR2Client();
  if (!client) {
    console.log("[Storage] R2 not configured, skipping audio upload");
    return null;
  }

  try {
    return await uploadAudioToR2(client, audioBuffer, options);
  } catch (err) {
    console.error("[Storage] Audio upload failed:", err);
    return null;
  }
}
