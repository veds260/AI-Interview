import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, interviews, clients } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the client record for this user
    const client = await db.query.clients.findFirst({
      where: eq(clients.userId, session.user.id),
    });

    if (!client) {
      // No client record means no interviews yet
      return NextResponse.json([]);
    }

    const userInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.clientId, client.id))
      .orderBy(desc(interviews.createdAt));

    return NextResponse.json(userInterviews);
  } catch (error) {
    console.error("Failed to fetch interviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
}
