import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db, users, clients } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate role (only client or writer allowed for self-registration)
    const validRoles = ["client", "writer"];
    const userRole = validRoles.includes(role) ? role : "client";

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: userRole,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    // If client role, also create a client record
    if (userRole === "client") {
      await db.insert(clients).values({
        userId: newUser.id,
        name: name || email.split("@")[0],
      });
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: { id: newUser.id, email: newUser.email, role: newUser.role },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
