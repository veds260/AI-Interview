import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { elevenlabs } from "@/lib/services/elevenlabs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, forSimli } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!elevenlabs.isConfigured()) {
      // Return null to indicate client should use browser TTS
      return NextResponse.json({
        audioUrl: null,
        pcmData: null,
        message: "ElevenLabs not configured, use browser TTS",
      });
    }

    // Get both MP3 (for fallback) and PCM (for Simli lip-sync) in parallel
    const [audioBuffer, pcmBuffer] = await Promise.all([
      elevenlabs.textToSpeech(text),
      forSimli ? elevenlabs.textToSpeechPCM(text) : Promise.resolve(null),
    ]);

    if (!audioBuffer) {
      return NextResponse.json({
        audioUrl: null,
        pcmData: null,
        message: "Failed to generate audio",
      });
    }

    // Convert MP3 to base64 data URL for fallback playback
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    // Convert PCM to base64 for Simli
    const pcmData = pcmBuffer ? Buffer.from(pcmBuffer).toString("base64") : null;

    return NextResponse.json({ audioUrl, pcmData });
  } catch (error) {
    console.error("Error generating speech:", error);
    return NextResponse.json({
      audioUrl: null,
      pcmData: null,
      error: "Failed to generate speech",
    });
  }
}
