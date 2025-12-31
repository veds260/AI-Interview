/**
 * Deepgram API Integration
 * Real-time speech-to-text transcription
 *
 * Documentation: https://developers.deepgram.com
 */

export interface DeepgramConfig {
  apiKey: string;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: {
    word: string;
    start: number;
    end: number;
    confidence: number;
  }[];
  isFinal: boolean;
}

class DeepgramService {
  private apiKey: string;
  private baseUrl = "https://api.deepgram.com/v1";

  constructor(config?: DeepgramConfig) {
    this.apiKey = config?.apiKey || process.env.DEEPGRAM_API_KEY || "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get WebSocket URL for real-time transcription
   */
  getWebSocketUrl(): string {
    const params = new URLSearchParams({
      model: "nova-2",
      language: "en-US",
      smart_format: "true",
      punctuate: "true",
      interim_results: "true",
      endpointing: "300",
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Transcribe audio file (pre-recorded)
   */
  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptionResult | null> {
    if (!this.isConfigured()) {
      console.warn("Deepgram not configured. Returning null.");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/listen?model=nova-2&smart_format=true`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "audio/webm",
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.results?.channels?.[0]?.alternatives?.[0];

      if (!result) {
        return null;
      }

      return {
        transcript: result.transcript,
        confidence: result.confidence,
        words: result.words || [],
        isFinal: true,
      };
    } catch (error) {
      console.error("Failed to transcribe audio:", error);
      return null;
    }
  }

  /**
   * Create a real-time transcription connection
   * Returns WebSocket connection that emits transcription events
   */
  createRealtimeConnection(
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): WebSocket | null {
    if (!this.isConfigured()) {
      console.warn("Deepgram not configured.");
      return null;
    }

    try {
      const ws = new WebSocket(this.getWebSocketUrl());

      ws.onopen = () => {
        console.log("Deepgram WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const result = data.channel?.alternatives?.[0];

          if (result && result.transcript) {
            onTranscript({
              transcript: result.transcript,
              confidence: result.confidence || 0,
              words: result.words || [],
              isFinal: data.is_final || false,
            });
          }
        } catch (e) {
          console.error("Error parsing Deepgram message:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("Deepgram WebSocket error:", event);
        onError(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        console.log("Deepgram WebSocket closed");
      };

      return ws;
    } catch (error) {
      console.error("Failed to create Deepgram connection:", error);
      return null;
    }
  }
}

export const deepgram = new DeepgramService();
export default DeepgramService;
