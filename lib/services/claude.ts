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
      bio?: string;
      products?: string[];
      talkingPoints?: string[];
      competitorTopics?: string[];
      otherQAs?: { question: string; response: string }[];
    },
    trackingContext?: { interviewId?: string; clientId?: string }
  ): Promise<ContentExtraction | null> {
    if (!this.isConfigured()) {
      console.warn("OpenRouter API not configured. Returning mock extraction.");
      return this.mockExtraction(question, response);
    }

    const startTime = Date.now();
    try {
      // Build rich context from all available information
      let contextInfo = "";

      if (clientContext) {
        contextInfo = `
═══════════════════════════════════════════════════════════════
FOUNDER CONTEXT (Use this to make content authentic & specific):
═══════════════════════════════════════════════════════════════

Name: ${clientContext.name || "Unknown"}
`;

        if (clientContext.bio) {
          contextInfo += `\nBio/Background:\n${clientContext.bio}\n`;
        }

        if (clientContext.products?.length) {
          contextInfo += `\nProducts/Services: ${clientContext.products.join(", ")}\n`;
        }

        if (clientContext.topics?.length) {
          contextInfo += `\nExpertise Areas: ${clientContext.topics.join(", ")}\n`;
        }

        if (clientContext.talkingPoints?.length) {
          contextInfo += `\nKey Talking Points:\n${clientContext.talkingPoints.map(tp => `- ${tp}`).join("\n")}\n`;
        }

        if (clientContext.voiceStyle) {
          contextInfo += `\nVoice/Tone Guidelines: ${clientContext.voiceStyle}\n`;
        }

        if (clientContext.competitorTopics?.length) {
          contextInfo += `\nTrending Topics in Their Space: ${clientContext.competitorTopics.slice(0, 10).join(", ")}\n`;
        }

        // Include other Q&As from the same interview for context
        if (clientContext.otherQAs?.length) {
          contextInfo += `\n═══════════════════════════════════════════════════════════════
OTHER INSIGHTS FROM THIS INTERVIEW (for context/consistency):
═══════════════════════════════════════════════════════════════\n`;
          clientContext.otherQAs.slice(0, 5).forEach((qa, i) => {
            contextInfo += `\n${i + 1}. Q: ${qa.question}\n   A: ${qa.response.substring(0, 300)}${qa.response.length > 300 ? "..." : ""}\n`;
          });
        }
      }

      const promptContent = `You are creating social media content for a founder based on ONE specific interview answer.

═══════════════════════════════════════════════════════════════
THE ANSWER TO TRANSFORM (THIS IS YOUR PRIMARY SOURCE):
═══════════════════════════════════════════════════════════════

Question: ${question}

Answer: ${response}

═══════════════════════════════════════════════════════════════
CONTEXT REFERENCE (USE SELECTIVELY - NOT ALL OF IT):
═══════════════════════════════════════════════════════════════
${contextInfo || "No additional context provided."}

═══════════════════════════════════════════════════════════════
CRITICAL RULES FOR CONTEXT USAGE:
═══════════════════════════════════════════════════════════════

1. THE ANSWER IS PRIMARY: 90% of your content must come directly from the answer above. The answer contains the actual story, insight, or experience to share.

2. CONTEXT IS OPTIONAL SEASONING: Only use context details IF they directly relate to what's being discussed in THIS specific answer. Most posts won't need any context.

3. RELEVANCE TEST: Before adding ANY context detail, ask: "Does this directly connect to the topic of THIS answer?" If no, don't use it.
   - If the answer is about writing for 50 paisa per word, do NOT mention Instagram followers
   - If the answer is about hiring, do NOT mention their podcast
   - If the answer is about a specific failure, do NOT add unrelated achievements

4. NO FORCED ADDITIONS: Never add context just to make content "richer." A clean post from the answer alone is better than one stuffed with irrelevant details.

5. ONE STORY PER POST: Each post should tell ONE coherent story or make ONE point from the answer. Don't try to cram multiple achievements or facts.

6. USE OTHER Q&As ONLY FOR CONSISTENCY: The other interview answers are there so you don't contradict something they said elsewhere. They are NOT for mixing into this content.

═══════════════════════════════════════════════════════════════
CONTENT RULES:
═══════════════════════════════════════════════════════════════

FORBIDDEN:
- Hashtags
- Em dashes (—)
- Rhetorical questions ("The truth?", "Want to know why?")
- Staccato patterns ("Same X. Same Y. Same Z.")
- Formulaic patterns ("Thing isn't X. It's Y.")
- Generic motivational phrases
- Mixing unrelated achievements/facts from context

TWEET FORMAT:
- Strong hook (surprising fact, bold claim from THE ANSWER)
- Blank line after hook
- 2-3 short paragraphs, each = one idea
- End with insight from THE ANSWER
- Example:
  "We almost shut down in month 3.

  Our biggest client ghosted us. Payroll was due in 5 days. I had $800 in the bank.

  That week taught me more about sales than any book ever could."

LINKEDIN FORMAT:
- Strong hook from THE ANSWER
- 3-5 short paragraphs with line breaks
- Each paragraph = 1-2 sentences
- End with reflection or lesson from THE ANSWER

STYLE:
- 5th grade reading level
- First person ("I")
- ONE clear insight per post
- Specific details from THE ANSWER (numbers, names, timeframes)
- Active voice

═══════════════════════════════════════════════════════════════

Return valid JSON:
{
  "contentType": "origin_story|failure_story|success_story|turning_point|hot_take|contrarian_view|industry_critique|prediction|technical|framework|how_to|lessons|values|habits|influences|advice",
  "topics": ["topic1", "topic2"],
  "keyQuote": "Best soundbite from THE ANSWER (under 280 chars)",
  "summary": "1-2 sentence summary",
  "tweetDraft": "Tweet based primarily on THE ANSWER",
  "threadOutline": ["Point 1", "Point 2", "Point 3"],
  "linkedinDraft": "LinkedIn post based primarily on THE ANSWER",
  "suggestedFormats": ["tweet", "thread", "linkedin", "blog"],
  "web2Friendly": true or false,
  "technicalDepth": 1-5,
  "controversyLevel": 1-5,
  "storytellingPotential": 1-5
}

Use \\n for line breaks. Return ONLY the JSON.`;

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
    response: string,
    context?: {
      clientName?: string;
      industry?: string;
      topics?: string[];
      competitorTopics?: string[];
      previousQuestions?: string[];
      questionNumber?: number;
    }
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    // Build context info
    let contextInfo = "";
    if (context) {
      if (context.clientName) {
        contextInfo += `Founder: ${context.clientName}\n`;
      }
      if (context.industry) {
        contextInfo += `Industry: ${context.industry}\n`;
      }
      if (context.topics?.length) {
        contextInfo += `Their expertise: ${context.topics.join(", ")}\n`;
      }
      if (context.competitorTopics?.length) {
        contextInfo += `Hot topics in their space: ${context.competitorTopics.slice(0, 5).join(", ")}\n`;
      }
      if (context.previousQuestions?.length) {
        contextInfo += `Already asked (DO NOT repeat similar questions): ${context.previousQuestions.join(" | ")}\n`;
      }
    }

    // Vary the question type based on question number
    const questionTypes = [
      "Dig deeper into a specific detail or claim they made",
      "Ask about a challenge or obstacle related to what they said",
      "Explore the 'why' behind their decision or approach",
      "Ask about what surprised them or what they learned",
      "Connect their answer to a broader trend or hot topic in their industry",
      "Ask about the impact or results of what they described",
      "Explore an alternative approach they considered",
      "Ask about advice they'd give based on this experience",
    ];

    const typeIndex = (context?.questionNumber || 0) % questionTypes.length;
    const questionFocus = questionTypes[typeIndex];

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
          model: "anthropic/claude-3-haiku", // Use Haiku for faster follow-ups
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `You are interviewing a founder. Generate ONE follow-up question.

${contextInfo ? `CONTEXT:\n${contextInfo}\n` : ""}
LAST EXCHANGE:
Q: ${question}
A: ${response}

QUESTION FOCUS FOR THIS FOLLOW-UP:
${questionFocus}

RULES:
- Ask ONE specific, conversational question
- Make it relevant to THEIR industry/experience, not generic
- DO NOT ask for "an example" or "a specific story" (too repetitive)
- DO NOT repeat topics from previous questions
- Connect to hot topics in their space if relevant
- Keep it short (under 25 words)

Return ONLY the follow-up question.`,
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
