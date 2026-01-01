import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoClips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Initialize R2 client
const getR2Client = () => {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
    },
  });
};

// Get single clip
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const clip = await db.query.videoClips.findFirst({
      where: eq(videoClips.id, id),
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    return NextResponse.json({ clip });
  } catch (error) {
    console.error("Error fetching clip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete clip (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete clips
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Get the clip to find the file key
    const clip = await db.query.videoClips.findFirst({
      where: eq(videoClips.id, id),
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // Extract the file key from the URL
    const videoUrl = clip.videoUrl;
    let fileKey: string | null = null;

    // Parse the key from URL (format: .../clips/timestamp-randomid.webm)
    const match = videoUrl.match(/clips\/[\w-]+\.webm$/);
    if (match) {
      fileKey = match[0];
    }

    // Delete from R2 if configured and we have a key
    const r2Client = getR2Client();
    if (r2Client && fileKey) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          })
        );
        console.log("Deleted from R2:", fileKey);
      } catch (r2Error) {
        console.error("Failed to delete from R2:", r2Error);
        // Continue to delete from database even if R2 fails
      }
    }

    // Delete from database
    await db.delete(videoClips).where(eq(videoClips.id, id));

    return NextResponse.json({
      success: true,
      message: "Clip deleted",
      deletedBytes: clip.fileSizeBytes || 0,
    });
  } catch (error) {
    console.error("Error deleting clip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
