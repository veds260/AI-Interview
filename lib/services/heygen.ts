/**
 * HeyGen Streaming Avatar Service
 * Real-time AI avatar for video interviews
 */

export interface HeyGenConfig {
  apiKey: string;
}

class HeyGenService {
  private apiKey: string;
  private baseUrl = "https://api.heygen.com/v1";

  constructor(config?: HeyGenConfig) {
    this.apiKey = config?.apiKey || process.env.HEYGEN_API_KEY || "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Create an access token for the streaming avatar SDK
   * This token is used client-side to initialize StreamingAvatar
   */
  async createAccessToken(): Promise<string | null> {
    if (!this.isConfigured()) {
      console.warn("HeyGen not configured");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/streaming.create_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("HeyGen token error:", error);
        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.token || null;
    } catch (error) {
      console.error("Failed to create HeyGen token:", error);
      return null;
    }
  }

  /**
   * List available streaming avatars
   */
  async listStreamingAvatars(): Promise<any[] | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/streaming/avatar.list`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HeyGen list avatars error:", errorText);
        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Available streaming avatars:", JSON.stringify(data.data?.avatars?.slice(0, 5), null, 2));
      return data.data?.avatars || [];
    } catch (error) {
      console.error("Failed to list streaming avatars:", error);
      return null;
    }
  }

  /**
   * List available avatars (legacy)
   */
  async listAvatars(): Promise<any[] | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/interactive_avatars`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.interactive_avatars || [];
    } catch (error) {
      console.error("Failed to list avatars:", error);
      return null;
    }
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<any[] | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.voices || [];
    } catch (error) {
      console.error("Failed to list voices:", error);
      return null;
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }
}

export const heygen = new HeyGenService();
export default HeyGenService;
