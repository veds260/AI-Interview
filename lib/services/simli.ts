/**
 * Simli API Integration
 * Real-time AI avatar video streaming
 *
 * Documentation: https://docs.simli.com
 */

export interface SimliConfig {
  apiKey: string;
  faceId: string;
}

export interface SimliSession {
  sessionId: string;
  iceServers: RTCIceServer[];
}

class SimliService {
  private apiKey: string;
  private faceId: string;
  private baseUrl = "https://api.simli.ai";

  constructor(config?: SimliConfig) {
    this.apiKey = config?.apiKey || process.env.SIMLI_API_KEY || "";
    this.faceId = config?.faceId || process.env.SIMLI_FACE_ID || "";
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.faceId);
  }

  async createSession(): Promise<SimliSession | null> {
    if (!this.isConfigured()) {
      console.warn("Simli not configured. Returning mock session.");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/startAudioToVideoSession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          faceId: this.faceId,
          apiKey: this.apiKey,
          syncAudio: true,
          handleSilence: true,
          maxSessionLength: 3600,
          maxIdleTime: 300,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Simli API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        sessionId: data.session_token || data.session_id,
        iceServers: data.ice_servers || [{ urls: "stun:stun.l.google.com:19302" }],
      };
    } catch (error) {
      console.error("Failed to create Simli session:", error);
      return null;
    }
  }

  async sendAudio(sessionId: string, audioData: ArrayBuffer): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await fetch(`${this.baseUrl}/audio/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-simli-api-key": this.apiKey,
        },
        body: audioData,
      });
    } catch (error) {
      console.error("Failed to send audio to Simli:", error);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await fetch(`${this.baseUrl}/session/${sessionId}/end`, {
        method: "POST",
        headers: {
          "x-simli-api-key": this.apiKey,
        },
      });
    } catch (error) {
      console.error("Failed to end Simli session:", error);
    }
  }
}

export const simli = new SimliService();
export default SimliService;
