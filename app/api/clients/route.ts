import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, clients } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allClients = await db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));

    return NextResponse.json(allClients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      brandName,
      twitterHandle,
      linkedinUrl,
      websiteUrl,
      topicsOfExpertise,
      voiceStyle,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name,
        brandName: brandName || null,
        twitterHandle: twitterHandle?.replace("@", "") || null,
        linkedinUrl: linkedinUrl || null,
        websiteUrl: websiteUrl || null,
        topicsOfExpertise: topicsOfExpertise || [],
        voiceStyle: voiceStyle || null,
      })
      .returning();

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
