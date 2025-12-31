import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import * as schema from "../lib/db/schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("Connecting to database...");
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("Creating admin user...");

  // Create admin user
  const adminEmail = "admin@compound.io";
  const adminPassword = await hash("admin123", 12);

  try {
    await db.insert(schema.users).values({
      email: adminEmail,
      passwordHash: adminPassword,
      name: "Admin User",
      role: "admin",
    });
    console.log(`Admin user created: ${adminEmail} / admin123`);
  } catch (e) {
    console.log("Admin user may already exist, skipping...");
  }

  // Create a sample writer
  const writerEmail = "writer@compound.io";
  const writerPassword = await hash("writer123", 12);

  try {
    await db.insert(schema.users).values({
      email: writerEmail,
      passwordHash: writerPassword,
      name: "Sample Writer",
      role: "writer",
    });
    console.log(`Writer user created: ${writerEmail} / writer123`);
  } catch (e) {
    console.log("Writer user may already exist, skipping...");
  }

  // Create a sample client
  const clientEmail = "founder@startup.io";
  const clientPassword = await hash("founder123", 12);

  try {
    const [clientUser] = await db
      .insert(schema.users)
      .values({
        email: clientEmail,
        passwordHash: clientPassword,
        name: "Jane Founder",
        role: "client",
      })
      .returning();

    // Create client profile
    await db.insert(schema.clients).values({
      userId: clientUser.id,
      name: "Jane Founder",
      brandName: "TechStartup Inc",
      twitterHandle: "janefounder",
      linkedinUrl: "https://linkedin.com/in/janefounder",
      websiteUrl: "https://techstartup.io",
      topicsOfExpertise: ["startup", "fundraising", "product"],
      voiceStyle:
        "Direct, no-nonsense, draws from personal experience, uses concrete examples",
    });

    console.log(`Client user created: ${clientEmail} / founder123`);
  } catch (e) {
    console.log("Client user may already exist, skipping...");
  }

  // Add starter questions if none exist
  const existingQuestions = await db.select().from(schema.questionBank).limit(1);

  if (existingQuestions.length === 0) {
    console.log("Adding starter questions...");

    const starterQuestions = [
      {
        question:
          "Walk me through how you first got into your industry. What was the moment it clicked for you?",
        category: "origin_story" as const,
        difficulty: "easy" as const,
        topics: ["background", "career"],
        expectedClipPotential: 8,
        web2Friendly: true,
      },
      {
        question:
          "Tell me about a time you were completely wrong about something important. What did you learn?",
        category: "failure_story" as const,
        difficulty: "medium" as const,
        topics: ["lessons", "mistakes"],
        expectedClipPotential: 9,
        web2Friendly: true,
      },
      {
        question:
          "What do you believe about your industry that most people would strongly disagree with?",
        category: "hot_take" as const,
        difficulty: "medium" as const,
        topics: ["opinion", "industry"],
        expectedClipPotential: 10,
        web2Friendly: false,
      },
      {
        question:
          "What's your mental model or framework for making difficult decisions?",
        category: "framework" as const,
        difficulty: "deep" as const,
        topics: ["decision-making", "strategy"],
        expectedClipPotential: 8,
        web2Friendly: true,
      },
      {
        question:
          "Where do you see your industry in 5 years? What's coming that most people aren't prepared for?",
        category: "prediction" as const,
        difficulty: "medium" as const,
        topics: ["future", "trends"],
        expectedClipPotential: 8,
        web2Friendly: true,
      },
      {
        question:
          "What would you tell someone just starting out in your field that you wish you knew?",
        category: "advice" as const,
        difficulty: "easy" as const,
        topics: ["advice", "beginners"],
        expectedClipPotential: 8,
        web2Friendly: true,
      },
      {
        question:
          "What's non-negotiable for you, even if it costs you money or opportunities?",
        category: "values" as const,
        difficulty: "deep" as const,
        topics: ["principles", "integrity"],
        expectedClipPotential: 9,
        web2Friendly: true,
      },
      {
        question:
          "What's broken about your industry that nobody wants to talk about?",
        category: "industry_critique" as const,
        difficulty: "deep" as const,
        topics: ["industry", "problems"],
        expectedClipPotential: 10,
        web2Friendly: true,
      },
    ];

    await db.insert(schema.questionBank).values(starterQuestions);
    console.log(`Added ${starterQuestions.length} starter questions`);
  }

  console.log("\nSeed completed!");
  console.log("\nTest accounts:");
  console.log("  Admin:   admin@compound.io / admin123");
  console.log("  Writer:  writer@compound.io / writer123");
  console.log("  Client:  founder@startup.io / founder123");

  await client.end();
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
