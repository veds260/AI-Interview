/**
 * Claude API Integration via OpenRouter
 * Content extraction and question generation
 *
 * Documentation: https://openrouter.ai/docs
 */

import { trackApiCall, estimateTokens } from "@/lib/utils/api-tracker";

export interface ContentExtraction {
  contentType: string;
  topics: string[];
  keyQuote: string;
  summary: string;
  tweetDraft: string;
  threadOutline: string[];
  linkedinDraft: string;
  suggestedFormats: string[];
  web2Friendly: boolean;
  technicalDepth: number;
  controversyLevel: number;
  storytellingPotential: number;
}

class ClaudeService {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  // Using Claude 3.5 Sonnet via OpenRouter - good balance of quality and cost
  private model = "anthropic/claude-3.5-sonnet";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async extractContent(
    question: string,
    response: string,
    clientContext?: {
      name?: string;
      topics?: string[];
      voiceStyle?: string;
    },
    trackingContext?: { interviewId?: string; clientId?: string }
  ): Promise<ContentExtraction | null> {
    if (!this.isConfigured()) {
      console.warn("OpenRouter API not configured. Returning mock extraction.");
      return this.mockExtraction(question, response);
    }

    const startTime = Date.now();
    try {
      const contextInfo = clientContext
        ? `
        Founder: ${clientContext.name || "Unknown"}
        Industry/Topics: ${clientContext.topics?.join(", ") || "General"}
        Voice Guidelines: ${clientContext.voiceStyle || "Professional, authentic"}
      `
        : "";

      const promptContent = `Extract structured content from this founder interview response.
              ${contextInfo}

              Question Asked: ${question}

              Response: ${response}

              CONTENT GENERATION RULES (CRITICAL - MUST FOLLOW):

              1. NO HASHTAGS - Never include hashtags in any content
              2. NO EM DASHES - Never use em dashes (—) in any content
              3. NO RHETORICAL QUESTIONS - Avoid "The truth?", "Want to know why?", "Here's the thing..."
              4. LENGTH FOR TWEETS: 280-450 characters with natural variation (not forced to exact limits)
              5. SIMPLE LANGUAGE - Write at 5th grade reading level, conversational tone
              6. VARY SENTENCE STRUCTURE - Mix short and longer sentences for natural rhythm
              7. FIRST PERSON - Write from the founder's perspective ("I" not "they")
              8. ONE CLEAR INSIGHT - Each tweet should focus on a single idea
              9. AVOID PATTERNS:
                 - No "Same X. Same Y. Same Z." staccato patterns
                 - No "Thing isn't X. It's Y." patterns
                 - No generic motivational phrases like "Your network is your net worth"
              10. BE SPECIFIC - Include concrete details from the response

              PROVEN TWEET FORMATS THAT WORK (use these as inspiration):
              - "I've [number/action]..." credential posts with specific insights
              - "Quick [topic] tip:" with contrasting observations
              - "Hot take:" for contrarian views
              - Story format: Set scene, share tension, reveal insight
              - "The biggest [domain] mistake is..." with explanation

              Extract and return valid JSON with exactly these fields:
              {
                "contentType": "origin_story|failure_story|success_story|turning_point|hot_take|contrarian_view|industry_critique|prediction|technical|framework|how_to|lessons|values|habits|influences|advice",
                "topics": ["topic1", "topic2"],
                "keyQuote": "The single best soundbite (under 280 chars)",
                "summary": "1-2 sentence summary of the content",
                "tweetDraft": "A tweet in founder's voice, 280-450 chars, no hashtags, follows rules above",
                "threadOutline": ["Point 1", "Point 2", "Point 3"],
                "linkedinDraft": "A LinkedIn post version if suitable (no hashtags)",
                "suggestedFormats": ["tweet", "thread", "linkedin", "blog"],
                "web2Friendly": true or false,
                "technicalDepth": 1-5,
                "controversyLevel": 1-5,
                "storytellingPotential": 1-5
              }

              Return ONLY the JSON object, no other text.`;

      const result = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
          "X-Title": "Compound Interviewer",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: promptContent,
            },
          ],
        }),
      });

      const endTime = Date.now();

      if (!result.ok) {
        const errorText = await result.text();
        await trackApiCall({
          interviewId: trackingContext?.interviewId,
          clientId: trackingContext?.clientId,
          provider: "openrouter",
          model: this.model,
          endpoint: "extraction",
          durationMs: endTime - startTime,
          success: false,
          errorMessage: `HTTP ${result.status}: ${errorText}`,
        });
        throw new Error(`OpenRouter API error: ${result.status} - ${errorText}`);
      }

      const data = await result.json();
      const content = data.choices?.[0]?.message?.content;

      // Track successful API call
      await trackApiCall({
        interviewId: trackingContext?.interviewId,
        clientId: trackingContext?.clientId,
        provider: "openrouter",
        model: this.model,
        endpoint: "extraction",
        inputTokens: data.usage?.prompt_tokens || estimateTokens(promptContent),
        outputTokens: data.usage?.completion_tokens || estimateTokens(content || ""),
        durationMs: endTime - startTime,
        success: true,
      });

      if (!content) {
        return this.mockExtraction(question, response);
      }

      try {
        // Handle potential markdown code blocks in response
        const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(jsonStr) as ContentExtraction;
      } catch {
        console.error("Failed to parse Claude response as JSON:", content);
        return this.mockExtraction(question, response);
      }
    } catch (error) {
      console.error("Claude extraction error:", error);
      return this.mockExtraction(question, response);
    }
  }

  private mockExtraction(question: string, response: string): ContentExtraction {
    // Determine content type based on question keywords
    let contentType = "advice";
    const questionLower = question.toLowerCase();

    if (
      questionLower.includes("story") ||
      questionLower.includes("started") ||
      questionLower.includes("began")
    ) {
      contentType = "origin_story";
    } else if (
      questionLower.includes("wrong") ||
      questionLower.includes("mistake") ||
      questionLower.includes("fail")
    ) {
      contentType = "failure_story";
    } else if (
      questionLower.includes("disagree") ||
      questionLower.includes("controversial") ||
      questionLower.includes("overhyped")
    ) {
      contentType = "hot_take";
    } else if (
      questionLower.includes("framework") ||
      questionLower.includes("process") ||
      questionLower.includes("system")
    ) {
      contentType = "framework";
    } else if (
      questionLower.includes("predict") ||
      questionLower.includes("future") ||
      questionLower.includes("years")
    ) {
      contentType = "prediction";
    }

    // Create a summary from the first 200 chars
    const summary =
      response.length > 200 ? response.substring(0, 197) + "..." : response;

    // Extract a potential key quote (first sentence or first 280 chars)
    const firstSentence = response.split(/[.!?]/)[0];
    const keyQuote =
      firstSentence.length > 280
        ? firstSentence.substring(0, 277) + "..."
        : firstSentence;

    return {
      contentType,
      topics: ["general"],
      keyQuote,
      summary,
      tweetDraft: keyQuote,
      threadOutline: [summary],
      linkedinDraft: response.substring(0, 500),
      suggestedFormats: ["tweet"],
      web2Friendly: true,
      technicalDepth: 2,
      controversyLevel: 2,
      storytellingPotential: 3,
    };
  }

  async generateFollowUp(
    question: string,
    response: string
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const result = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
          "X-Title": "Compound Interviewer",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Based on this interview exchange, generate a natural follow-up question to dig deeper.

Question: ${question}
Response: ${response}

Generate a single follow-up question that:
1. Explores something interesting from their response
2. Asks for a specific example or story
3. Sounds natural and conversational

Return ONLY the follow-up question, nothing else.`,
            },
          ],
        }),
      });

      if (!result.ok) {
        return null;
      }

      const data = await result.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error("Follow-up generation error:", error);
      return null;
    }
  }
}

export const claude = new ClaudeService();
export default ClaudeService;
