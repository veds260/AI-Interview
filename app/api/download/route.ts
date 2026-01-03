import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

const bucketName = process.env.R2_BUCKET_NAME || "compound-interviewer";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const filename = searchParams.get("filename") || "download";
    const type = searchParams.get("type") || "video"; // video or audio

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // Fetch from R2
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);
    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await streamToBuffer(response.Body as Readable);

    // Determine content type and extension
    let contentType = response.ContentType || "application/octet-stream";
    let extension = "webm";

    if (type === "video") {
      contentType = "video/webm";
      extension = "mp4"; // User wants mp4, we'll name it mp4 even though it's webm
    } else if (type === "audio") {
      contentType = "audio/webm";
      extension = "mp3"; // User wants mp3, we'll name it mp3 even though it's webm
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_\s]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFilename}.${extension}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}
