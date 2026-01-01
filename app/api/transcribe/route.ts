import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Get the audio data from the request
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Try Groq Whisper first (fast and has free tier)
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
          return NextResponse.json({ text: result.text });
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
          return NextResponse.json({ text: result.text });
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
        hint: "Add GROQ_API_KEY (free) or OPENAI_API_KEY to enable transcription"
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
