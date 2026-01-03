/**
 * Creates the post_comments table for the tweet mockup commenting feature.
 * Run this on Railway: npx tsx scripts/create-comments-table.ts
 */

import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function createCommentsTable() {
  try {
    console.log("Creating post_comments table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS post_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        extraction_id UUID NOT NULL REFERENCES content_extractions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        comment_text TEXT NOT NULL,
        selected_text TEXT,
        start_offset INTEGER,
        end_offset INTEGER,
        resolved BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log("post_comments table created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }

  process.exit(0);
}

createCommentsTable();
