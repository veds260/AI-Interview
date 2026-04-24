import { NextResponse } from 'next/server';
import { db, interviews, clients } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifyKey(req: Request): boolean {
  const key = req.headers.get('x-internal-api-key');
  return !!key && !!process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY;
}

export async function POST(req: Request) {
  if (!verifyKey(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    clientName?: string;
    knowledgeBase?: Record<string, unknown>;
    mode?: string;
    expiresInDays?: number;
  };

  const { clientName, knowledgeBase, mode = 'text_chat', expiresInDays = 3 } = body;
  if (!clientName) return NextResponse.json({ error: 'clientName required' }, { status: 400 });

  // Find or create a client record in the interviewer DB
  let client = await db.query.clients.findFirst({
    where: eq(clients.name, clientName),
  });

  if (!client) {
    const [inserted] = await db.insert(clients).values({
      name: clientName,
      knowledgeBase: knowledgeBase ?? {},
      isActive: true,
    }).returning();
    client = inserted;
  } else if (knowledgeBase && Object.keys(knowledgeBase).length > 0) {
    // Merge new context into existing knowledge base
    const merged = { ...((client.knowledgeBase as object) ?? {}), ...knowledgeBase };
    await db.update(clients)
      .set({ knowledgeBase: merged, updatedAt: new Date() })
      .where(eq(clients.id, client.id));
  }

  // Pre-generate the share token so the caller gets it immediately
  const shareToken = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [interview] = await db.insert(interviews).values({
    clientId: client.id,
    mode: mode as 'live_video' | 'text_chat',
    status: 'scheduled',
    title: `Interview – ${clientName} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    questionsAsked: [],
    shareToken,
    shareTokenExpiresAt: expiresAt,
    sessionState: {
      questions: [],
      currentIndex: 0,
      clientContext: knowledgeBase ?? {},
    },
  }).returning();

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
  const shareUrl = `${baseUrl}/shared/${shareToken}`;

  return NextResponse.json({
    interviewId: interview.id,
    shareToken,
    shareUrl,
    expiresAt: expiresAt.toISOString(),
  });
}
