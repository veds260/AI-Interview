/**
 * ElevenLabs API Integration
 * Text-to-Speech for audio interview mode
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
}

class ElevenLabsService {
  private apiKey: string;
  private voiceId: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  constructor(config?: ElevenLabsConfig) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || "";
    this.voiceId = config?.voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async textToSpeech(
    text: string,
    settings?: VoiceSettings
  ): Promise<ArrayBuffer | null> {
    if (!this.isConfigured()) {
      console.error("[ElevenLabs] NOT CONFIGURED - ELEVENLABS_API_KEY missing!");
      return null;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${this.voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: settings || {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ElevenLabs] ERROR ${response.status} (${duration}ms):`, errorText);
        return null;
      }

      const buffer = await response.arrayBuffer();
      console.log(`[ElevenLabs] SUCCESS: ${buffer.byteLength} bytes in ${duration}ms`);

      return buffer;
    } catch (error) {
      console.error("[ElevenLabs] EXCEPTION:", error);
      return null;
    }
  }

  setVoiceId(voiceId: string) {
    this.voiceId = voiceId;
  }

  getApiKey(): string {
    return this.apiKey;
  }
}

export const elevenlabs = new ElevenLabsService();
export default ElevenLabsService;
