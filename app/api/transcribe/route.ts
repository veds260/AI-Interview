import { NextRequest, NextResponse } from "next/server";
import { uploadAudioInBackgroundWithKey } from "@/lib/services/storage";

export async function POST(req: NextRequest) {
  try {
    // Get the audio data from the request
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const interviewId = formData.get("interviewId") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Get audio buffer once (used for both transcription and upload)
    const audioBuffer = await audioFile.arrayBuffer();
    const mimeType = audioFile.type || "audio/webm";

    // Generate audio key for R2 storage
    let audioKey: string | null = null;
    if (interviewId) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const extension = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "webm";
      audioKey = `audio/${interviewId}/${timestamp}-${randomId}.${extension}`;
    }

    // Helper to start background upload (called after transcription succeeds)
    const startBackgroundUpload = () => {
      if (interviewId && audioKey) {
        uploadAudioInBackgroundWithKey(audioBuffer, audioKey, mimeType);
      }
    };

    // Try Deepgram first (Nova-3 has best accuracy, same as HeyGen uses internally)
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey) {
      try {
        const response = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": mimeType,
            },
            body: audioBuffer,
          }
        );

        if (response.ok) {
          const result = await response.json();
          const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
          console.log("Deepgram transcription:", transcript);
          // Start upload AFTER transcription succeeds (no resource contention)
          startBackgroundUpload();
          return NextResponse.json({ text: transcript, audioKey });
        } else {
          const errorText = await response.text();
          console.error("Deepgram error:", errorText);
        }
      } catch (deepgramError) {
        console.error("Deepgram transcription failed:", deepgramError);
      }
    }

    // Fallback to Groq Whisper (fast and has free tier)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        groqFormData.append("file", audioFile, "audio.webm");
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("language", "en");

        const response = await fetch(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
            },
            body: groqFormData,
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("Groq transcription:", result.text);
          startBackgroundUpload();
          return NextResponse.json({ text: result.text, audioKey });
        } else {
          console.error("Groq error:", await response.text());
        }
      } catch (groqError) {
        console.error("Groq transcription failed:", groqError);
      }
    }

    // Fallback to OpenAI Whisper
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const openaiFormData = new FormData();
        openaiFormData.append("file", audioFile, "audio.webm");
        openaiFormData.append("model", "whisper-1");
        openaiFormData.append("language", "en");

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
            },
            body: openaiFormData,
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("OpenAI transcription:", result.text);
          startBackgroundUpload();
          return NextResponse.json({ text: result.text, audioKey });
        } else {
          console.error("OpenAI error:", await response.text());
        }
      } catch (openaiError) {
        console.error("OpenAI transcription failed:", openaiError);
      }
    }

    // No transcription service available
    return NextResponse.json(
      {
        error: "No transcription service configured",
        hint: "Add DEEPGRAM_API_KEY (recommended), GROQ_API_KEY, or OPENAI_API_KEY to enable transcription"
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
