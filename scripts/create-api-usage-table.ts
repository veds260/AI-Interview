/**
 * Create api_usage table for tracking API costs
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

async function main() {
  console.log("Creating api_usage table...");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100),
        endpoint VARCHAR(255),
        input_tokens INTEGER,
        output_tokens INTEGER,
        duration_ms INTEGER,
        cost_cents DECIMAL(10, 4),
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("api_usage table created successfully!");

    // Create index for faster queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_usage_interview_id ON api_usage(interview_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_usage_client_id ON api_usage(client_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
    `);

    console.log("Indexes created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
