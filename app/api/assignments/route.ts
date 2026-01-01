import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewAssignments, interviews, users, clients, contentExtractions } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

// GET /api/assignments - Get assignments (filtered by role)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let whereClause;

    if (session.user.role === "writer") {
      // Writers see only their assignments
      whereClause = eq(interviewAssignments.writerId, session.user.id);
    } else if (session.user.role === "admin") {
      // Admins see all assignments
      whereClause = undefined;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignmentsData = await db
      .select({
        assignment: interviewAssignments,
        interview: interviews,
        writer: users,
        client: clients,
      })
      .from(interviewAssignments)
      .leftJoin(interviews, eq(interviewAssignments.interviewId, interviews.id))
      .leftJoin(users, eq(interviewAssignments.writerId, users.id))
      .leftJoin(clients, eq(interviews.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(interviewAssignments.assignedAt));

    // Get extraction counts for each interview
    const assignmentsWithCounts = await Promise.all(
      assignmentsData.map(async (item) => {
        const extractions = await db
          .select()
          .from(contentExtractions)
          .where(eq(contentExtractions.interviewId, item.interview?.id || ""));

        return {
          id: item.assignment.id,
          interviewId: item.assignment.interviewId,
          writerId: item.assignment.writerId,
          status: item.assignment.status,
          notes: item.assignment.notes,
          contentProduced: item.assignment.contentProduced,
          assignedAt: item.assignment.assignedAt,
          completedAt: item.assignment.completedAt,
          interview: item.interview ? {
            id: item.interview.id,
            title: item.interview.title,
            mode: item.interview.mode,
            status: item.interview.status,
            questionsCount: item.interview.questionsCount,
            transcript: item.interview.transcript,
            recordingUrl: item.interview.recordingUrl,
            questionsAsked: item.interview.questionsAsked,
            completedAt: item.interview.completedAt,
          } : null,
          writer: item.writer ? {
            id: item.writer.id,
            name: item.writer.name,
            email: item.writer.email,
          } : null,
          client: item.client ? {
            id: item.client.id,
            name: item.client.name,
            brandName: item.client.brandName,
            voiceStyle: item.client.voiceStyle,
            topicsOfExpertise: item.client.topicsOfExpertise,
            knowledgeBase: item.client.knowledgeBase,
          } : null,
          extractionsCount: extractions.length,
          extractions: extractions,
        };
      })
    );

    return NextResponse.json(assignmentsWithCounts);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST /api/assignments - Create new assignment
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { interviewId, writerId, notes } = body;

    if (!interviewId || !writerId) {
      return NextResponse.json(
        { error: "Interview ID and Writer ID are required" },
        { status: 400 }
      );
    }

    // Check if interview exists
    const interview = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1);

    if (!interview.length) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Check if writer exists
    const writer = await db
      .select()
      .from(users)
      .where(and(eq(users.id, writerId), eq(users.role, "writer")))
      .limit(1);

    if (!writer.length) {
      return NextResponse.json(
        { error: "Writer not found" },
        { status: 404 }
      );
    }

    // Create assignment
    const [assignment] = await db
      .insert(interviewAssignments)
      .values({
        interviewId,
        writerId,
        notes,
        status: "pending",
      })
      .returning();

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}
