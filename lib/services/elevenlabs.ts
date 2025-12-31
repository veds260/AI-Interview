/**
 * ElevenLabs API Integration
 * Text-to-Speech and Speech-to-Text for AI avatar
 *
 * Documentation: https://docs.elevenlabs.io
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface TranscriptionResult {
  text: string;
  words?: {
    text: string;
    start: number;
    end: number;
    confidence: number;
  }[];
  language_code?: string;
  language_probability?: number;
}

class ElevenLabsService {
  private apiKey: string;
  private voiceId: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  constructor(config?: ElevenLabsConfig) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || "";
    // Default to Rachel voice (professional, clear)
    this.voiceId = config?.voiceId || "21m00Tcm4TlvDq8ikWAM";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Convert text to speech audio (MP3 format for regular playback)
   */
  async textToSpeech(
    text: string,
    settings?: VoiceSettings
  ): Promise<ArrayBuffer | null> {
    if (!this.isConfigured()) {
      console.warn("ElevenLabs not configured. Returning null.");
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2", // Faster model for real-time
            voice_settings: settings || {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS API error: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Failed to generate speech:", error);
      return null;
    }
  }

  /**
   * Convert text to speech in PCM16 format at 16kHz (for Simli lip-sync)
   */
  async textToSpeechPCM(
    text: string,
    settings?: VoiceSettings
  ): Promise<ArrayBuffer | null> {
    if (!this.isConfigured()) {
      console.warn("ElevenLabs not configured. Returning null.");
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${this.voiceId}/stream?output_format=pcm_16000`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: settings || {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS PCM API error: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Failed to generate PCM speech:", error);
      return null;
    }
  }

  /**
   * Convert speech audio to text (Speech-to-Text / Transcription)
   */
  async speechToText(
    audioBuffer: ArrayBuffer,
    options?: {
      language_code?: string; // e.g., "en" for English
    }
  ): Promise<TranscriptionResult | null> {
    if (!this.isConfigured()) {
      console.warn("ElevenLabs not configured. Returning null.");
      return null;
    }

    try {
      // Create form data with audio file
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
      formData.append("file", audioBlob, "audio.webm");

      // Required: model_id for STT
      formData.append("model_id", "scribe_v1");

      // Add optional parameters
      if (options?.language_code) {
        formData.append("language_code", options.language_code);
      }

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs STT API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        text: data.text || "",
        words: data.words,
        language_code: data.language_code,
        language_probability: data.language_probability,
      };
    } catch (error) {
      console.error("Failed to transcribe speech:", error);
      return null;
    }
  }

  /**
   * Transcribe audio from a URL
   */
  async transcribeFromUrl(
    audioUrl: string,
    options?: {
      language_code?: string;
    }
  ): Promise<TranscriptionResult | null> {
    if (!this.isConfigured()) {
      console.warn("ElevenLabs not configured. Returning null.");
      return null;
    }

    try {
      // Fetch the audio file
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      return this.speechToText(audioBuffer, options);
    } catch (error) {
      console.error("Failed to transcribe from URL:", error);
      return null;
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<object[] | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error("Failed to fetch voices:", error);
      return null;
    }
  }

  /**
   * Set the voice ID for TTS
   */
  setVoiceId(voiceId: string) {
    this.voiceId = voiceId;
  }

  /**
   * Get the API key (for WebSocket connections if needed)
   */
  getApiKey(): string {
    return this.apiKey;
  }
}

export const elevenlabs = new ElevenLabsService();
export default ElevenLabsService;
