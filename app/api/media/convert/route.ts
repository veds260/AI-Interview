import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PassThrough } from "stream";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
    const format = searchParams.get("format") as "mp4" | "mp3" | null;
    const filename = searchParams.get("filename") || "download";

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    if (!format || !["mp4", "mp3"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use mp4 or mp3" }, { status: 400 });
    }

    // Fetch the original file from R2
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);
    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Convert the S3 stream to a buffer
    const inputBuffer = await streamToBuffer(response.Body as Readable);

    // Convert using ffmpeg
    const outputBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on("data", (chunk) => chunks.push(chunk));
      passThrough.on("end", () => resolve(Buffer.concat(chunks)));
      passThrough.on("error", reject);

      const inputStream = new Readable();
      inputStream.push(inputBuffer);
      inputStream.push(null);

      const ffmpegCommand = ffmpeg(inputStream)
        .inputFormat("webm");

      if (format === "mp4") {
        ffmpegCommand
          .outputFormat("mp4")
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions(["-movflags", "frag_keyframe+empty_moov"]);
      } else if (format === "mp3") {
        ffmpegCommand
          .outputFormat("mp3")
          .audioCodec("libmp3lame")
          .audioBitrate("192k")
          .noVideo();
      }

      ffmpegCommand
        .on("error", (err: Error) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .pipe(passThrough, { end: true });
    });

    // Return the converted file
    const contentType = format === "mp4" ? "video/mp4" : "audio/mpeg";
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, "_");

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFilename}.${format}"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Conversion failed", details: String(error) },
      { status: 500 }
    );
  }
}
