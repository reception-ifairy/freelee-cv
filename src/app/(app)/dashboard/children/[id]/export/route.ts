import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { chats, consents, messages, personas } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { childContext } from '@/lib/children/child-mode';
import { loadPlan } from '@/lib/children/plan';
import { openText } from '@/lib/crypto/envelope';

/**
 * Everything freelee holds about one child, for their parent (docs/54): the
 * profile, the learning plan with progress, every lesson in clear, and the
 * consents. Decrypted only here, only for the profile's own parent.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response('Sign in first.', { status: 401 });
  const { id } = await params;
  const ctx = await childContext(user.id, id);
  if (!ctx) return new Response('Not found.', { status: 404 });

  const lessons = await db
    .select({ id: chats.id, title: chats.title, createdAt: chats.createdAt, lastMessageAt: chats.lastMessageAt, tutor: personas.name })
    .from(chats)
    .leftJoin(personas, eq(personas.id, chats.personaId))
    .where(and(eq(chats.childProfileId, id), eq(chats.userId, user.id)))
    .orderBy(asc(chats.createdAt));
  const rows = lessons.length
    ? await db.select().from(messages).where(inArray(messages.chatId, lessons.map((l) => l.id))).orderBy(asc(messages.position))
    : [];

  const body = {
    exportedAt: new Date().toISOString(),
    note: 'Everything freelee.cv holds about this child. The profile, plan and lessons are stored encrypted with this child’s own key.',
    profile: { ...ctx.profile, createdAt: ctx.row.createdAt, lastActiveAt: ctx.row.lastActiveAt },
    plan: await loadPlan(ctx.row, ctx.key),
    lessons: lessons.map((l) => ({
      ...l,
      messages: rows
        .filter((m) => m.chatId === l.id && m.status === 'complete')
        .map((m) => ({ role: m.role, at: m.createdAt, text: openText(ctx.key, 'message', m.content) })),
    })),
    consents: await db.select({ kind: consents.kind, textVersion: consents.textVersion, grantedAt: consents.grantedAt, withdrawnAt: consents.withdrawnAt }).from(consents).where(eq(consents.childProfileId, id)),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="child-profile-${ctx.profile.pseudonym.replace(/[^A-Za-z0-9-]/g, '_')}.json"`,
      'cache-control': 'no-store',
    },
  });
}
