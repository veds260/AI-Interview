import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function addProfilePictureColumn() {
  try {
    console.log("Adding profile_picture column to clients table...");
    await db.execute(sql`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_picture TEXT
    `);
    console.log("Column added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

addProfilePictureColumn();
