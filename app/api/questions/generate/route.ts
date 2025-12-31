import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, questionBank } from "@/lib/db";

// Default starter questions when Claude API is not available
const STARTER_QUESTIONS = [
  // Origin Stories
  {
    question: "Walk me through how you first got into your industry. What was the moment it clicked for you?",
    category: "origin_story",
    difficulty: "easy",
    topics: ["background", "career"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What were you doing before this? How did that experience shape what you're building now?",
    category: "origin_story",
    difficulty: "easy",
    topics: ["background", "journey"],
    expectedClipPotential: 7,
    web2Friendly: true,
  },
  {
    question: "Tell me about a pivotal moment early in your career that completely changed your trajectory.",
    category: "turning_point",
    difficulty: "medium",
    topics: ["career", "growth"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },

  // Failure Stories
  {
    question: "Tell me about a time you were completely wrong about something important. What did you learn?",
    category: "failure_story",
    difficulty: "medium",
    topics: ["lessons", "mistakes"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },
  {
    question: "What's your biggest professional regret, and how has it shaped your approach since?",
    category: "failure_story",
    difficulty: "deep",
    topics: ["regret", "growth"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "Describe a moment when everything fell apart. How did you pick up the pieces?",
    category: "failure_story",
    difficulty: "deep",
    topics: ["resilience", "recovery"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },

  // Hot Takes
  {
    question: "What do you believe about your industry that most people would strongly disagree with?",
    category: "hot_take",
    difficulty: "medium",
    topics: ["opinion", "industry"],
    expectedClipPotential: 10,
    web2Friendly: false,
  },
  {
    question: "What's overhyped in your space right now that people will look back on and cringe?",
    category: "hot_take",
    difficulty: "medium",
    topics: ["trends", "criticism"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },
  {
    question: "What popular advice in your field do you think is actually harmful?",
    category: "contrarian_view",
    difficulty: "medium",
    topics: ["advice", "contrarian"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },
  {
    question: "What's something everyone in your industry does that you refuse to do? Why?",
    category: "contrarian_view",
    difficulty: "medium",
    topics: ["principles", "differentiation"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },

  // Technical/Framework
  {
    question: "Explain your main area of expertise like I'm smart but not an expert in your field.",
    category: "technical",
    difficulty: "medium",
    topics: ["expertise", "education"],
    expectedClipPotential: 7,
    web2Friendly: true,
  },
  {
    question: "What's your mental model or framework for making difficult decisions?",
    category: "framework",
    difficulty: "deep",
    topics: ["decision-making", "strategy"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What system or process have you developed that others could learn from?",
    category: "how_to",
    difficulty: "medium",
    topics: ["process", "productivity"],
    expectedClipPotential: 7,
    web2Friendly: true,
  },

  // Predictions
  {
    question: "Where do you see your industry in 5 years? What's coming that most people aren't prepared for?",
    category: "prediction",
    difficulty: "medium",
    topics: ["future", "trends"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What trend is everyone sleeping on that you're betting big on?",
    category: "prediction",
    difficulty: "medium",
    topics: ["trends", "opportunity"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },

  // Advice
  {
    question: "What would you tell someone just starting out in your field that you wish you knew?",
    category: "advice",
    difficulty: "easy",
    topics: ["advice", "beginners"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What's the most important lesson you've learned that school or traditional education never taught you?",
    category: "lessons",
    difficulty: "medium",
    topics: ["education", "life lessons"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },

  // Values & Personal
  {
    question: "What do you optimize for in your life that most people don't?",
    category: "values",
    difficulty: "medium",
    topics: ["values", "priorities"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What's non-negotiable for you, even if it costs you money or opportunities?",
    category: "values",
    difficulty: "deep",
    topics: ["principles", "integrity"],
    expectedClipPotential: 9,
    web2Friendly: true,
  },
  {
    question: "What daily habit or practice has had the biggest impact on your success?",
    category: "habits",
    difficulty: "easy",
    topics: ["habits", "productivity"],
    expectedClipPotential: 7,
    web2Friendly: true,
  },
  {
    question: "Who has influenced your thinking the most, and what did you learn from them?",
    category: "influences",
    difficulty: "medium",
    topics: ["mentors", "learning"],
    expectedClipPotential: 7,
    web2Friendly: true,
  },

  // Success Stories
  {
    question: "Tell me about a win that surprised even you. What made it happen?",
    category: "success_story",
    difficulty: "medium",
    topics: ["success", "achievement"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
  {
    question: "What's the best decision you've ever made in your career? Walk me through how you made it.",
    category: "success_story",
    difficulty: "medium",
    topics: ["decisions", "success"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },

  // Industry Critique
  {
    question: "What's broken about your industry that nobody wants to talk about?",
    category: "industry_critique",
    difficulty: "deep",
    topics: ["industry", "problems"],
    expectedClipPotential: 10,
    web2Friendly: true,
  },
  {
    question: "If you could change one thing about how your industry operates, what would it be?",
    category: "industry_critique",
    difficulty: "medium",
    topics: ["change", "improvement"],
    expectedClipPotential: 8,
    web2Friendly: true,
  },
];

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if we have Claude API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      // TODO: Use Claude to generate personalized questions
      // For now, fall through to starter questions
    }

    // Insert starter questions
    const insertedQuestions = await db
      .insert(questionBank)
      .values(STARTER_QUESTIONS.map((q) => ({
        ...q,
        category: q.category as typeof questionBank.$inferInsert.category,
        difficulty: q.difficulty as typeof questionBank.$inferInsert.difficulty,
      })))
      .returning();

    return NextResponse.json({
      message: `Generated ${insertedQuestions.length} questions`,
      count: insertedQuestions.length,
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
