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

    // Try OpenRouter first (uses Gemini for audio transcription)
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      try {
        // Convert audio to base64
        const audioBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");

        // Determine audio format from mime type
        const mimeType = audioFile.type || "audio/webm";
        const formatMap: Record<string, string> = {
          "audio/webm": "webm",
          "audio/mp4": "m4a",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/ogg": "ogg",
        };
        const format = formatMap[mimeType] || "webm";

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openrouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
              "X-Title": "Compound Interviewer",
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Transcribe this audio exactly as spoken. Output only the transcription, nothing else. If the audio is silent or unclear, respond with an empty string.",
                    },
                    {
                      type: "input_audio",
                      input_audio: {
                        data: base64Audio,
                        format: format,
                      },
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result.choices?.[0]?.message?.content?.trim() || "";
          console.log("OpenRouter transcription:", text);
          return NextResponse.json({ text });
        } else {
          const errorText = await response.text();
          console.error("OpenRouter error:", errorText);
        }
      } catch (openrouterError) {
        console.error("OpenRouter transcription failed:", openrouterError);
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
        hint: "Add OPENROUTER_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY to enable transcription"
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
