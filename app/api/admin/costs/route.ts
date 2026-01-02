import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, apiUsage, interviews, clients } from "@/lib/db";
import { desc, eq, sql, and, gte } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const interviewId = searchParams.get("interviewId");
    const days = parseInt(searchParams.get("days") || "30");

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    let whereClause = gte(apiUsage.createdAt, startDate);
    if (clientId) {
      whereClause = and(whereClause, eq(apiUsage.clientId, clientId))!;
    }
    if (interviewId) {
      whereClause = and(whereClause, eq(apiUsage.interviewId, interviewId))!;
    }

    // Get aggregated costs by client
    const costsByClient = await db
      .select({
        clientId: apiUsage.clientId,
        clientName: clients.name,
        totalCostCents: sql<number>`sum(${apiUsage.costCents})::numeric`,
        callCount: sql<number>`count(*)::int`,
        avgDurationMs: sql<number>`avg(${apiUsage.durationMs})::int`,
      })
      .from(apiUsage)
      .leftJoin(clients, eq(apiUsage.clientId, clients.id))
      .where(whereClause)
      .groupBy(apiUsage.clientId, clients.name)
      .orderBy(desc(sql`sum(${apiUsage.costCents})`));

    // Get aggregated costs by provider/model
    const costsByModel = await db
      .select({
        provider: apiUsage.provider,
        model: apiUsage.model,
        totalCostCents: sql<number>`sum(${apiUsage.costCents})::numeric`,
        callCount: sql<number>`count(*)::int`,
        avgDurationMs: sql<number>`avg(${apiUsage.durationMs})::int`,
        totalInputTokens: sql<number>`sum(${apiUsage.inputTokens})::int`,
        totalOutputTokens: sql<number>`sum(${apiUsage.outputTokens})::int`,
      })
      .from(apiUsage)
      .where(whereClause)
      .groupBy(apiUsage.provider, apiUsage.model)
      .orderBy(desc(sql`sum(${apiUsage.costCents})`));

    // Get aggregated costs by endpoint
    const costsByEndpoint = await db
      .select({
        endpoint: apiUsage.endpoint,
        totalCostCents: sql<number>`sum(${apiUsage.costCents})::numeric`,
        callCount: sql<number>`count(*)::int`,
        avgDurationMs: sql<number>`avg(${apiUsage.durationMs})::int`,
        successRate: sql<number>`(sum(case when ${apiUsage.success} then 1 else 0 end)::float / count(*) * 100)::int`,
      })
      .from(apiUsage)
      .where(whereClause)
      .groupBy(apiUsage.endpoint)
      .orderBy(desc(sql`sum(${apiUsage.costCents})`));

    // Get recent calls for detail view
    const recentCalls = await db
      .select({
        id: apiUsage.id,
        provider: apiUsage.provider,
        model: apiUsage.model,
        endpoint: apiUsage.endpoint,
        costCents: apiUsage.costCents,
        durationMs: apiUsage.durationMs,
        inputTokens: apiUsage.inputTokens,
        outputTokens: apiUsage.outputTokens,
        success: apiUsage.success,
        createdAt: apiUsage.createdAt,
        clientName: clients.name,
        interviewId: apiUsage.interviewId,
      })
      .from(apiUsage)
      .leftJoin(clients, eq(apiUsage.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(apiUsage.createdAt))
      .limit(100);

    // Calculate totals
    const totals = await db
      .select({
        totalCostCents: sql<number>`sum(${apiUsage.costCents})::numeric`,
        totalCalls: sql<number>`count(*)::int`,
        avgCostPerCall: sql<number>`avg(${apiUsage.costCents})::numeric`,
      })
      .from(apiUsage)
      .where(whereClause);

    return NextResponse.json({
      summary: {
        totalCostCents: Number(totals[0]?.totalCostCents || 0),
        totalCalls: totals[0]?.totalCalls || 0,
        avgCostPerCall: Number(totals[0]?.avgCostPerCall || 0),
        days,
      },
      byClient: costsByClient.map(c => ({
        ...c,
        totalCostCents: Number(c.totalCostCents || 0),
      })),
      byModel: costsByModel.map(m => ({
        ...m,
        totalCostCents: Number(m.totalCostCents || 0),
      })),
      byEndpoint: costsByEndpoint.map(e => ({
        ...e,
        totalCostCents: Number(e.totalCostCents || 0),
      })),
      recentCalls: recentCalls.map(c => ({
        ...c,
        costCents: Number(c.costCents || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch costs" },
      { status: 500 }
    );
  }
}
