import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// POST /api/admin/migrations - Run pending migrations
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { migration } = await request.json();

    const results: string[] = [];

    if (migration === "post_comments" || migration === "all") {
      // Create post_comments table if it doesn't exist
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
      results.push("post_comments table created/verified");
    }

    return NextResponse.json({
      success: true,
      message: "Migrations completed",
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/admin/migrations - Check migration status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check which tables exist
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = (tables as unknown as { table_name: string }[]).map((r) => r.table_name);

    return NextResponse.json({
      tables: tableNames,
      migrations: {
        post_comments: tableNames.includes("post_comments"),
      },
    });
  } catch (error) {
    console.error("Migration status error:", error);
    return NextResponse.json(
      { error: "Failed to check migration status" },
      { status: 500 }
    );
  }
}
