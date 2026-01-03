/**
 * API Usage Tracker
 * Tracks API calls and costs to database
 */

import { db } from "@/lib/db";
import { apiUsage } from "@/lib/db/schema";

// Pricing in USD - verified from official sources Jan 2026
// OpenRouter: https://openrouter.ai/pricing
// HeyGen: https://docs.heygen.com/reference/limits (0.2 credits/min, ~$0.10/min at Scale)
// Deepgram: https://deepgram.com/pricing ($0.0043/min batch, $0.0077/min streaming)
// OpenAI TTS: https://platform.openai.com/docs/pricing ($15/1M chars = $0.015/1K chars)
const PRICING = {
  // Claude models via OpenRouter (per 1M tokens)
  "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
  "anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
  "anthropic/claude-3-sonnet": { input: 3, output: 15 },
  // HeyGen streaming avatar (per minute) - 0.2 credits/min at $0.50/credit (Scale plan)
  heygen: { perMinute: 0.10 },
  // Deepgram Nova-2 (per minute) - using streaming rate for real-time interviews
  deepgram: { perMinute: 0.0077 },
  "deepgram-batch": { perMinute: 0.0043 },
  // OpenAI TTS (per 1K characters)
  "openai/tts-1": { per1kChars: 0.015 },
  "openai/tts-1-hd": { per1kChars: 0.03 },
  // ElevenLabs (Creator plan: $0.30/1K chars, Starter: ~$0.30/1K)
  // Source: https://elevenlabs.io/pricing
  elevenlabs: { per1kChars: 0.30 },
  "eleven_turbo_v2": { per1kChars: 0.30 },
};

interface TrackApiCallParams {
  interviewId?: string;
  clientId?: string;
  provider: string;
  model?: string;
  endpoint: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  characters?: number; // For TTS
  success?: boolean;
  errorMessage?: string;
}

export async function trackApiCall(params: TrackApiCallParams) {
  try {
    // Calculate cost
    let costCents = 0;

    if (params.model && PRICING[params.model as keyof typeof PRICING]) {
      const pricing = PRICING[params.model as keyof typeof PRICING] as { input: number; output: number };
      if (pricing.input && params.inputTokens) {
        costCents += (params.inputTokens / 1_000_000) * pricing.input * 100;
      }
      if (pricing.output && params.outputTokens) {
        costCents += (params.outputTokens / 1_000_000) * pricing.output * 100;
      }
    }

    // HeyGen pricing (per minute)
    if (params.provider === "heygen" && params.durationMs) {
      costCents += (params.durationMs / 60000) * 0.08 * 100;
    }

    // Deepgram pricing (per minute)
    if (params.provider === "deepgram" && params.durationMs) {
      costCents += (params.durationMs / 60000) * 0.0043 * 100;
    }

    // OpenAI TTS pricing (per 1k chars)
    if (params.provider === "openai" && params.characters) {
      const ttsPrice = params.model === "tts-1-hd" ? 0.03 : 0.015;
      costCents += (params.characters / 1000) * ttsPrice * 100;
    }

    // ElevenLabs pricing (per 1k chars) - $0.30/1k for Creator plan
    if (params.provider === "elevenlabs" && params.characters) {
      const elevenLabsPrice = 0.30; // $0.30 per 1000 characters (Creator plan)
      costCents += (params.characters / 1000) * elevenLabsPrice * 100;
    }

    await db.insert(apiUsage).values({
      interviewId: params.interviewId,
      clientId: params.clientId,
      provider: params.provider,
      model: params.model,
      endpoint: params.endpoint,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      durationMs: params.durationMs,
      costCents: costCents.toFixed(4),
      success: params.success ?? true,
      errorMessage: params.errorMessage,
    });

    // Log to console for debugging
    console.log(
      `[API Track] ${params.provider}${params.model ? `/${params.model}` : ""} | ${params.endpoint} | $${(costCents / 100).toFixed(5)}`
    );

    return costCents;
  } catch (error) {
    console.error("Failed to track API usage:", error);
    return 0;
  }
}

// Estimate tokens from text (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
