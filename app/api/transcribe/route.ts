import { NextRequest, NextResponse } from "next/server";
import { elevenlabs } from "@/lib/services/elevenlabs";

export async function POST(req: NextRequest) {
  try {
    // Check if ElevenLabs is configured
    if (!elevenlabs.isConfigured()) {
      return NextResponse.json({
        mock: true,
        text: "",
        message: "ElevenLabs not configured. Use browser transcription.",
      });
    }

    // Get the audio data from the request
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const languageCode = formData.get("language_code") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert Blob to ArrayBuffer
    const audioBuffer = await audioFile.arrayBuffer();

    // Transcribe using ElevenLabs
    const result = await elevenlabs.speechToText(audioBuffer, {
      language_code: languageCode || "en",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Transcription failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text: result.text,
      words: result.words,
      language_code: result.language_code,
      language_probability: result.language_probability,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
