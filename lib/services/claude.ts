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

              ═══════════════════════════════════════════════════════════════
              CONTENT GENERATION RULES (CRITICAL - MUST FOLLOW):
              ═══════════════════════════════════════════════════════════════

              FORBIDDEN (NEVER USE):
              - Hashtags (never include any)
              - Em dashes (—)
              - Rhetorical questions ("The truth?", "Want to know why?", "Here's the thing...")
              - Staccato patterns ("Same X. Same Y. Same Z.")
              - Formulaic patterns ("Thing isn't X. It's Y.")
              - Generic motivational phrases ("Your network is your net worth")
              - Clichés and buzzwords

              ═══════════════════════════════════════════════════════════════
              TWEET FORMATTING:
              ═══════════════════════════════════════════════════════════════

              HOOK (First Line) - This is the most important part:
              - Must stop the scroll and grab attention immediately
              - Use a surprising fact, bold claim, or intriguing statement
              - Front-load the value - best insight goes first
              - Examples of strong hooks:
                • "I lost $2M before I learned this..."
                • "After 500 customer calls, one pattern kept showing up."
                • "Most founders get pricing completely backwards."
                • "The best hire I ever made almost didn't happen."
                • "We grew 10x by doing the opposite of what VCs told us."

              STRUCTURE - Use line breaks for readability:
              - Put a blank line after the hook
              - Break into 2-3 short paragraphs
              - Each paragraph = one idea
              - End with insight or takeaway

              EXAMPLE OF GOOD TWEET FORMAT:
              "We almost shut down in month 3.

              Our biggest client ghosted us. Payroll was due in 5 days. I had $800 in the bank.

              That week taught me more about sales than any book ever could. Desperation creates clarity."

              ═══════════════════════════════════════════════════════════════
              LINKEDIN FORMATTING:
              ═══════════════════════════════════════════════════════════════

              STRUCTURE:
              - Strong hook (first line visible before "see more")
              - Blank line after hook
              - 3-5 short paragraphs with line breaks between each
              - Each paragraph = 1-2 sentences max
              - End with reflection or lesson learned
              - More professional tone than Twitter but still personal

              EXAMPLE OF GOOD LINKEDIN FORMAT:
              "I interviewed 200 candidates before making my first hire.

              Everyone told me I was crazy. 'Just hire fast and fire fast,' they said.

              But I knew culture would make or break us.

              That first hire? She's now my COO.

              The extra time upfront saved us years of pain later."

              ═══════════════════════════════════════════════════════════════
              WRITING STYLE:
              ═══════════════════════════════════════════════════════════════

              - 5th grade reading level, conversational
              - First person ("I" not "they")
              - One clear insight per post
              - Specific details from the response (numbers, names, timeframes)
              - Mix short and longer sentences for rhythm
              - Active voice, not passive
              - Show vulnerability when the story calls for it

              ═══════════════════════════════════════════════════════════════

              Extract and return valid JSON with exactly these fields:
              {
                "contentType": "origin_story|failure_story|success_story|turning_point|hot_take|contrarian_view|industry_critique|prediction|technical|framework|how_to|lessons|values|habits|influences|advice",
                "topics": ["topic1", "topic2"],
                "keyQuote": "The single best soundbite (under 280 chars)",
                "summary": "1-2 sentence summary of the content",
                "tweetDraft": "A tweet with strong hook, line breaks for spacing, follows formatting rules above",
                "threadOutline": ["Point 1", "Point 2", "Point 3"],
                "linkedinDraft": "A LinkedIn post with hook, line breaks between paragraphs, professional but personal",
                "suggestedFormats": ["tweet", "thread", "linkedin", "blog"],
                "web2Friendly": true or false,
                "technicalDepth": 1-5,
                "controversyLevel": 1-5,
                "storytellingPotential": 1-5
              }

              IMPORTANT: Use \\n for line breaks in tweetDraft and linkedinDraft to create proper spacing.

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
