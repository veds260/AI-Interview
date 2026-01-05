/**
 * Fix competitors table - add missing columns
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function fixCompetitorsTable() {
  console.log("Fixing competitors table...");

  try {
    // Check if table exists first
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'competitors'
      ) as exists
    `);

    console.log("Table check result:", tableCheck);
    const tableExists = (tableCheck as any)[0]?.exists ?? (tableCheck as any).rows?.[0]?.exists;

    if (!tableExists) {
      console.log("Competitors table does not exist, creating it...");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS competitors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          twitter_handle VARCHAR(100) NOT NULL,
          name VARCHAR(255),
          recent_tweets JSONB DEFAULT '[]'::jsonb,
          voice_analysis JSONB DEFAULT '{}'::jsonb,
          topics TEXT[],
          avg_engagement DECIMAL(10, 2),
          last_scraped_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("Created competitors table");
    } else {
      // Table exists, add missing columns
      console.log("Adding missing columns to competitors table...");

      // Add twitter_handle if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100)
      `).catch(() => console.log("twitter_handle might already exist or error adding"));

      // Add name if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS name VARCHAR(255)
      `).catch(() => console.log("name might already exist or error adding"));

      // Add recent_tweets if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS recent_tweets JSONB DEFAULT '[]'::jsonb
      `).catch(() => console.log("recent_tweets might already exist or error adding"));

      // Add voice_analysis if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS voice_analysis JSONB DEFAULT '{}'::jsonb
      `).catch(() => console.log("voice_analysis might already exist or error adding"));

      // Add topics if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS topics TEXT[]
      `).catch(() => console.log("topics might already exist or error adding"));

      // Add avg_engagement if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS avg_engagement DECIMAL(10, 2)
      `).catch(() => console.log("avg_engagement might already exist or error adding"));

      // Add last_scraped_at if not exists
      await db.execute(sql`
        ALTER TABLE competitors
        ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP
      `).catch(() => console.log("last_scraped_at might already exist or error adding"));

      console.log("Done adding columns");
    }

    // Verify the table structure
    const columns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'competitors'
      ORDER BY ordinal_position
    `);

    console.log("\nCurrent competitors table columns:");
    const colArray = Array.isArray(columns) ? columns : (columns as any).rows || [];
    colArray.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log("\nCompetitors table fixed successfully!");
  } catch (error) {
    console.error("Error fixing competitors table:", error);
    throw error;
  }

  process.exit(0);
}

fixCompetitorsTable();
