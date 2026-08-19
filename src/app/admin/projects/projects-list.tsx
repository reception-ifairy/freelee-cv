'use client';

import { FolderKanban, Pause, Pencil, Play, Trash2, CheckCheck, Archive } from 'lucide-react';
import { ResourceView, type ResourceItem, type BadgeTone } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { setProjectStatusAction, deleteProjectAction } from '@/server/actions/admin-projects';

export type ProjectRowData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colour: string | null;
  status: string;
  budgetCredits: number | null;
  spent: number;
  chats: number;
  rooms: number;
  crews: number;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  active: 'green',
  paused: 'amber',
  done: 'brand',
  archived: 'slate',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  done: 'Done',
  archived: 'Archived',
};

export function ProjectsList({ rows, view }: { rows: ProjectRowData[]; view: AdminView }) {
  const { run } = useAdminAction();
  // One shared scale so the bars rank projects against each other.
  const topSpend = Math.max(1, ...rows.map((r) => r.spent));

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.description,
    href: `/admin/projects/${row.id}`,
    media: (
      <span
        className="block size-9 rounded-xl border border-white/10"
        style={{ background: row.colour ?? '#6366f1' }}
        aria-hidden
      />
    ),
    badges: [{ label: STATUS_LABEL[row.status] ?? row.status, tone: STATUS_TONE[row.status] ?? 'slate' }],
    meta: [
      {
        label: 'Work',
        // One cell rather than three: chats, rooms and crews are only ever
        // read together as "how much is in here".
        value: `${row.chats} chat${row.chats === 1 ? '' : 's'} · ${row.rooms} room${row.rooms === 1 ? '' : 's'} · ${row.crews} crew${row.crews === 1 ? '' : 's'}`,
      },
      {
        label: row.budgetCredits === null ? 'Spent' : 'Budget',
        // Against its own budget when there is one, against the busiest
        // project when there isn't — otherwise an uncapped project would
        // always render a full bar or an empty one.
        value: (
          <Meter
            value={row.spent}
            max={row.budgetCredits ?? topSpend}
            tone={
              row.budgetCredits !== null && row.spent > row.budgetCredits * 0.9
                ? 'rose'
                : row.budgetCredits !== null && row.spent > row.budgetCredits * 0.7
                  ? 'amber'
                  : 'emerald'
            }
            display={
              row.budgetCredits === null
                ? row.spent.toLocaleString('en-GB')
                : `${row.spent.toLocaleString('en-GB')} / ${row.budgetCredits.toLocaleString('en-GB')}`
            }
            label="Credits spent"
          />
        ),
      },
    ],
    actions: [
      { label: 'Open project', href: `/admin/projects/${row.id}`, icon: <Pencil className="size-4" /> },
      ...(row.status !== 'active'
        ? [{ label: 'Mark active', icon: <Play className="size-4" />, onSelect: () => run(setProjectStatusAction, { id: row.id, status: 'active' }) }]
        : [{ label: 'Pause', icon: <Pause className="size-4" />, onSelect: () => run(setProjectStatusAction, { id: row.id, status: 'paused' }) }]),
      ...(row.status !== 'done'
        ? [{ label: 'Mark done', icon: <CheckCheck className="size-4" />, onSelect: () => run(setProjectStatusAction, { id: row.id, status: 'done' }) }]
        : []),
      ...(row.status !== 'archived'
        ? [{ label: 'Archive', icon: <Archive className="size-4" />, onSelect: () => run(setProjectStatusAction, { id: row.id, status: 'archived' }) }]
        : []),
      {
        // The menu's two-step confirm covers the click; the wording covers the
        // fear. Nothing inside the project is deleted with it.
        label: 'Delete project',
        icon: <Trash2 className="size-4" />,
        onSelect: () => run(deleteProjectAction, { id: row.id }),
        danger: true,
        separated: true,
      },
    ],
  }));

  return (
    <ResourceView
      module="projects"
      view={view}
      items={items}
      badgeHeader="Status"
      columns={3}
      empty={{
        icon: FolderKanban,
        title: 'No projects yet',
        description:
          'A project groups the chats, rooms and bot teams that belong to one piece of work, and tracks what it has cost. Create one with the form beside this list.',
      }}
    />
  );
}
