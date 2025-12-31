import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, interviewAssignments } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// GET /api/writers - Get all writers (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const writers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "writer"))
      .orderBy(desc(users.createdAt));

    // Get assignment counts for each writer
    const writersWithStats = await Promise.all(
      writers.map(async (writer) => {
        const assignments = await db
          .select()
          .from(interviewAssignments)
          .where(eq(interviewAssignments.writerId, writer.id));

        const pending = assignments.filter((a) => a.status === "pending").length;
        const inProgress = assignments.filter((a) => a.status === "in_progress").length;
        const completed = assignments.filter((a) => a.status === "completed").length;

        return {
          ...writer,
          assignmentsCount: {
            total: assignments.length,
            pending,
            inProgress,
            completed,
          },
        };
      })
    );

    return NextResponse.json(writersWithStats);
  } catch (error) {
    console.error("Error fetching writers:", error);
    return NextResponse.json(
      { error: "Failed to fetch writers" },
      { status: 500 }
    );
  }
}

// POST /api/writers - Create new writer (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email, name, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create writer
    const [writer] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: "writer",
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(writer);
  } catch (error) {
    console.error("Error creating writer:", error);
    return NextResponse.json(
      { error: "Failed to create writer" },
      { status: 500 }
    );
  }
}
