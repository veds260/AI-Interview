import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { interviews, interviewMessages, videoClips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Initialize R2 client
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

export async function POST(req: NextRequest) {
  try {
    // Check if R2 is configured
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY) {
      console.log("R2 not configured, skipping upload");
      return NextResponse.json(
        { error: "Storage not configured", hint: "Add R2 credentials to enable video storage" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const interviewId = formData.get("interviewId") as string | null;
    const messageId = formData.get("messageId") as string | null;

    if (!videoFile) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = `clips/${timestamp}-${randomId}.webm`;

    // Convert file to buffer
    const buffer = Buffer.from(await videoFile.arrayBuffer());

    // Upload to R2
    const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: buffer,
        ContentType: videoFile.type || "video/webm",
      })
    );

    // Construct public URL (assumes bucket has public access or custom domain)
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${filename}`
      : `https://${bucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;

    console.log("Video uploaded to R2:", publicUrl);

    // Get clientId from interview if available
    let clientId: string | null = null;
    if (interviewId) {
      try {
        const interview = await db.query.interviews.findFirst({
          where: eq(interviews.id, interviewId),
          columns: { clientId: true },
        });
        clientId = interview?.clientId || null;
      } catch (e) {
        console.error("Failed to get interview:", e);
      }
    }

    // Create video clip record
    let clipId: string | null = null;
    try {
      const [clip] = await db
        .insert(videoClips)
        .values({
          interviewId: interviewId || undefined,
          messageId: messageId || undefined,
          clientId: clientId || undefined,
          videoUrl: publicUrl,
          fileSizeBytes: buffer.length,
        })
        .returning({ id: videoClips.id });

      clipId = clip.id;
      console.log("Created video clip record:", clipId);
    } catch (dbError) {
      console.error("Failed to create video clip record:", dbError);
    }

    // Update interview recording URL if interviewId provided
    if (interviewId) {
      try {
        await db
          .update(interviews)
          .set({ recordingUrl: publicUrl })
          .where(eq(interviews.id, interviewId));
        console.log("Updated interview recording URL");
      } catch (dbError) {
        console.error("Failed to update interview:", dbError);
      }
    }

    // Update message audio URL if messageId provided
    if (messageId) {
      try {
        await db
          .update(interviewMessages)
          .set({ audioUrl: publicUrl })
          .where(eq(interviewMessages.id, messageId));
        console.log("Updated message audio URL");
      } catch (dbError) {
        console.error("Failed to update message:", dbError);
      }
    }

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: buffer.length,
      clipId,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
