/**
 * Text-to-Speech for audio interview mode
 * Uses Microsoft Edge Neural TTS (free, no API key needed)
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Best voices for interview style:
// en-US-AndrewNeural (Male, warm professional)
// en-US-BrianNeural (Male, conversational)
// en-US-EmmaNeural (Female, clear)
// en-US-AvaNeural (Female, natural)
// en-GB-RyanNeural (Male, British, polished)
// en-GB-SoniaNeural (Female, British)
// en-AU-WilliamMultilingualNeural (Male, Australian)

const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-US-AndrewNeural';

class TTSService {
  private voice: string;

  constructor() {
    this.voice = DEFAULT_VOICE;
  }

  isConfigured(): boolean {
    return true; // Edge TTS needs no API key
  }

  async textToSpeech(text: string): Promise<ArrayBuffer | null> {
    const startTime = Date.now();

    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(this.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const { audioStream } = tts.toStream(text);

      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve, reject) => {
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);
      const duration = Date.now() - startTime;
      console.log(`[TTS] ${this.voice}: ${buffer.byteLength} bytes in ${duration}ms`);

      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      console.error("[TTS] ERROR:", error);
      return null;
    }
  }

  setVoice(voice: string) {
    this.voice = voice;
  }

  getVoice(): string {
    return this.voice;
  }
}

export const elevenlabs = new TTSService();
export default TTSService;
