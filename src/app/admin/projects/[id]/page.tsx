import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderKanban, MessageSquare, Users, Bot } from 'lucide-react';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { projects, chats, conversations, personas } from '@/db/schema';
import { crews } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Textarea, Select, Label, Hint } from '@/components/ui/field';
import { InlineForm } from '@/components/admin/inline-form';
import { projectTotals } from '@/lib/projects/queries';
import { saveProjectAction } from '@/server/actions/admin-projects';
import { formatCredits, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, id)).limit(1);
  return { title: project?.name ?? 'Project' };
}

export default async function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) notFound();

  const [totals, projectChats, projectRooms, projectCrews] = await Promise.all([
    projectTotals(id),
    db
      .select({ id: chats.id, title: chats.title, lastMessageAt: chats.lastMessageAt, personaName: personas.name })
      .from(chats)
      .leftJoin(personas, eq(personas.id, chats.personaId))
      .where(eq(chats.projectId, id))
      .orderBy(desc(chats.lastMessageAt))
      .limit(10),
    db
      .select({ id: conversations.id, title: conversations.title, kind: conversations.kind, lastMessageAt: conversations.lastMessageAt })
      .from(conversations)
      .where(eq(conversations.projectId, id))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(10),
    db
      .select({ id: crews.id, name: crews.name, mode: crews.mode })
      .from(crews)
      .where(eq(crews.projectId, id))
      .limit(10),
  ]);

  const usedPercent =
    project.budgetCredits && project.budgetCredits > 0
      ? Math.round((totals.spent / project.budgetCredits) * 100)
      : null;

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description ?? `/${project.slug}`}
        actions={
          <Link
            href="/admin/projects"
            className="inline-flex h-10 items-center gap-2 rounded-control border hairline px-4 text-sm font-semibold"
          >
            <ArrowLeft className="size-4" /> Projects
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Spent"
          icon={FolderKanban}
          value={formatCredits(totals.spent)}
          hint={
            project.budgetCredits === null
              ? 'No budget set'
              : `of ${formatCredits(project.budgetCredits)} budget${usedPercent === null ? '' : ` · ${usedPercent}%`}`
          }
        />
        <StatTile label="Chats" icon={MessageSquare} value={String(totals.chats)} />
        <StatTile label="Rooms" icon={Users} value={String(totals.rooms)} />
        <StatTile label="Bot teams" icon={Bot} value={String(totals.crews)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card padding="md">
            <h2 className="font-semibold">Chats</h2>
            {projectChats.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No chats filed here"
                description="One-to-one conversations assigned to this project will appear here."
                className="mt-4 border-0 py-8"
              />
            ) : (
              <ul className="mt-4 divide-y hairline">
                {projectChats.map((chat) => (
                  <li key={chat.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{chat.title ?? 'Untitled'}</span>
                    <span className="shrink-0 text-xs text-slate-400">{chat.personaName ?? 'No persona'}</span>
                    <span className="shrink-0 text-xs text-slate-500">{relativeTime(chat.lastMessageAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="md">
            <h2 className="font-semibold">Rooms and runs</h2>
            {projectRooms.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nothing here yet"
                description="Group rooms and bot-team runs filed under this project will appear here."
                className="mt-4 border-0 py-8"
              />
            ) : (
              <ul className="mt-4 divide-y hairline">
                {projectRooms.map((room) => (
                  <li key={room.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{room.title ?? 'Untitled'}</span>
                    {/* Runs and rooms live in the same table and read very
                        differently — one is a transcript, one is a machine
                        doing work. Saying which is which matters. */}
                    <Badge tone={room.kind === 'crew_run' ? 'brand' : 'slate'}>
                      {room.kind === 'crew_run' ? 'Team run' : 'Room'}
                    </Badge>
                    <span className="shrink-0 text-xs text-slate-500">{relativeTime(room.lastMessageAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <InlineForm action={saveProjectAction} title="Project settings" submitLabel="Save project">
          <input type="hidden" name="id" value={project.id} />
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={project.name} />
          </div>
          <div>
            <Label htmlFor="description">What is it for?</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={project.description ?? ''} />
          </div>
          <div>
            <Label htmlFor="colour">Colour</Label>
            <Input id="colour" name="colour" type="color" defaultValue={project.colour ?? '#6366f1'} className="h-10 p-1" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={project.status}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="budgetCredits">Budget (credits)</Label>
            <Input
              id="budgetCredits"
              name="budgetCredits"
              type="number"
              min={0}
              defaultValue={project.budgetCredits ?? ''}
              placeholder="Leave blank for no cap"
            />
            <Hint>Blank means no cap, which is not the same as a budget of zero.</Hint>
          </div>
        </InlineForm>
      </div>
    </div>
  );
}
