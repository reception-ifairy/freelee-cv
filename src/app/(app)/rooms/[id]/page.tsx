import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, eq, and, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  conversations, conversationParticipants, conversationMessages,
  personas, teamMembers, users,
} from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { assertParticipant, postMessageAction, addPersonaToRoomAction, addUserToRoomAction } from '@/modules/group-chat/actions';
import { RoomLive } from '@/modules/group-chat/components/room-live';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea, Select, Hint } from '@/components/ui/field';
import { initialsOf, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Room' };

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const user = await requireUser();

  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) notFound();
  if (!(await isModuleEnabledForTeam(conversation.teamId, 'group-chat'))) notFound();

  try {
    await assertParticipant(conversationId, user.id);
  } catch {
    notFound();
  }

  const [participants, messages, availablePersonas, teamUsers] = await Promise.all([
    db.select().from(conversationParticipants).where(eq(conversationParticipants.conversationId, conversationId)),
    db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.position)),
    db.select().from(personas).where(eq(personas.teamId, conversation.teamId)).orderBy(personas.name),
    db
      .select({ id: users.id, name: users.name })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, conversation.teamId), ne(users.id, user.id))),
  ]);

  const participantByKey = new Map(participants.map((p) => [`${p.participantType}:${p.participantId}`, p]));
  const addedPersonaIds = new Set(
    participants.filter((p) => p.participantType === 'persona').map((p) => p.participantId),
  );
  const addedUserIds = new Set(participants.filter((p) => p.participantType === 'user').map((p) => p.participantId));

  const personaOptions = availablePersonas.filter((p) => !addedPersonaIds.has(String(p.id)));
  const userOptions = teamUsers.filter((u) => !addedUserIds.has(u.id));

  return (
    <div className="container-app py-8">
      <RoomLive conversationId={conversationId} />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <h1 className="text-xl font-bold tracking-tight">{conversation.title || 'Untitled room'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {participants.length} participant{participants.length === 1 ? '' : 's'} ·{' '}
            {conversation.messageCount} messages
          </p>

          <Card className="mt-4 flex h-[60vh] flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-400">
                  No messages yet. Say hello, or @mention a persona to bring it into the conversation.
                </p>
              ) : (
                messages.map((message) => {
                  const key = `${message.authorType}:${message.authorId ?? ''}`;
                  const author = participantByKey.get(key);
                  const isPersona = message.authorType === 'persona';

                  return (
                    <div key={message.id} className="flex items-start gap-3">
                      <span
                        className={
                          isPersona
                            ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white'
                            : 'grid size-8 shrink-0 place-items-center rounded-full bg-slate-300 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }
                      >
                        {initialsOf(author?.displayName ?? '?')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {author?.displayName ?? (isPersona ? 'Persona' : 'Someone')}
                          </span>
                          {isPersona ? <Badge tone="brand">@{author?.mentionHandle}</Badge> : null}
                          <span className="text-xs text-slate-400">{relativeTime(message.createdAt)}</span>
                        </div>
                        {message.status === 'failed' ? (
                          <p className="mt-1 text-sm text-rose-500">{message.error ?? 'This message failed.'}</p>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                            {message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form action={postMessageAction} className="border-t border-slate-200 p-4 dark:border-slate-800">
              <input type="hidden" name="conversationId" value={conversationId} />
              <Textarea
                name="content"
                rows={2}
                required
                placeholder={`Message the room… @mention a persona (${participants
                  .filter((p) => p.participantType === 'persona')
                  .map((p) => `@${p.mentionHandle}`)
                  .join(', ') || 'none yet'}) to bring it in.`}
              />
              <div className="mt-2 flex items-center justify-between">
                <Hint>Mentioned personas reply once each, in parallel — not token-streamed.</Hint>
                <button
                  type="submit"
                  className="h-9 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Send
                </button>
              </div>
            </form>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Participants</h2>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      p.participantType === 'persona'
                        ? 'grid size-6 shrink-0 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-white'
                        : 'grid size-6 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }
                  >
                    {initialsOf(p.displayName ?? '?')}
                  </span>
                  <span className="truncate">{p.displayName}</span>
                  <span className="ml-auto text-xs text-slate-400">@{p.mentionHandle}</span>
                </div>
              ))}
            </div>
          </Card>

          {personaOptions.length > 0 ? (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">Add a persona</h3>
              <form action={addPersonaToRoomAction} className="flex gap-2">
                <input type="hidden" name="conversationId" value={conversationId} />
                <Select name="personaId" className="h-9 text-xs" required>
                  {personaOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <button type="submit" className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  Add
                </button>
              </form>
            </Card>
          ) : null}

          {userOptions.length > 0 ? (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">Add a teammate</h3>
              <form action={addUserToRoomAction} className="flex gap-2">
                <input type="hidden" name="conversationId" value={conversationId} />
                <Select name="userId" className="h-9 text-xs" required>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
                <button type="submit" className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  Add
                </button>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
