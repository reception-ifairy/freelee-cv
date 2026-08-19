import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, personas } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { isModuleEnabledForTeam } from '@/lib/modules/db';
import { createRoomAction } from '@/modules/group-chat/actions';
import { Card } from '@/components/ui/card';
import { Input, Label, Checkbox, Hint } from '@/components/ui/field';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rooms' };

export default async function RoomsPage() {
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  if (!(await isModuleEnabledForTeam(teamId, 'group-chat'))) {
    notFound();
  }

  const [rooms, catalog] = await Promise.all([
    db.select().from(conversations)// `kind` filter added: without it every crew_run conversation appeared in
    // this list as an ordinary room, and could be posted into after the run
    // had finished. Runs have their own view at /crews/runs/[id].
    .where(and(eq(conversations.teamId, teamId), eq(conversations.kind, 'room'))).orderBy(desc(conversations.lastMessageAt)),
    db.select().from(personas).where(eq(personas.teamId, teamId)).orderBy(personas.name),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Multiple people and multiple personas in one thread — @mention a persona to bring it in.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Your rooms</h2>
          {rooms.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No rooms yet — create one to get started.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className="flex items-center justify-between gap-4 py-3.5 transition hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{room.title || 'Untitled room'}</p>
                    <p className="text-xs text-slate-400">{room.messageCount} messages</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{relativeTime(room.lastMessageAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">New room</h2>
          <form action={createRoomAction} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="Q4 campaign" />
            </div>

            {catalog.length > 0 ? (
              <div>
                <Label>Bring in personas</Label>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  {catalog.map((persona) => (
                    <label key={persona.id} className="flex items-center gap-2 text-sm">
                      <Checkbox name="personaIds" value={persona.id} />
                      {persona.name}
                    </label>
                  ))}
                </div>
                <Hint>You can add more people and personas once the room exists.</Hint>
              </div>
            ) : null}

            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-on-brand hover:bg-brand-700"
            >
              Create room
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
