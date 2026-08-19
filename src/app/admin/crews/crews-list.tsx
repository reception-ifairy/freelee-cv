'use client';

import { Bot, Pencil, Power, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem, type BadgeTone } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { toggleCrewActiveAction, deleteCrewAction } from '@/server/actions/admin-crews';

export type CrewRowData = {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  isActive: boolean;
  memberCount: number;
  runCount: number;
  lastRunStatus: string | null;
  projectName: string | null;
};

const MODE_LABEL: Record<string, string> = {
  sequential: 'Pipeline',
  parallel: 'Fan-out',
  supervisor: 'Delegating',
};

const RUN_TONE: Record<string, BadgeTone> = {
  completed: 'green',
  running: 'amber',
  queued: 'slate',
  failed: 'rose',
  budget_exceeded: 'rose',
  max_turns_reached: 'amber',
  cancelled: 'slate',
};

export function CrewsList({ rows, view }: { rows: CrewRowData[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.description,
    href: `/admin/crews/${row.id}`,
    badges: [
      // The stored value is `sequential`/`parallel`/`supervisor` — accurate but
      // jargon. What they mean is a pipeline, a fan-out and a delegator.
      { label: MODE_LABEL[row.mode] ?? row.mode, tone: 'brand' as const },
      ...(row.isActive ? [] : [{ label: 'Disabled', tone: 'slate' as const }]),
      ...(row.projectName ? [{ label: row.projectName, tone: 'slate' as const }] : []),
      ...(row.lastRunStatus
        ? [{ label: `Last run: ${row.lastRunStatus.replace(/_/g, ' ')}`, tone: RUN_TONE[row.lastRunStatus] ?? 'slate' }]
        : []),
    ],
    meta: [
      { label: 'Members', value: String(row.memberCount) },
      { label: 'Runs', value: String(row.runCount) },
    ],
    actions: [
      { label: 'Open team', href: `/admin/crews/${row.id}`, icon: <Pencil className="size-4" /> },
      {
        label: row.isActive ? 'Disable' : 'Enable',
        icon: <Power className="size-4" />,
        onSelect: () => run(toggleCrewActiveAction, { id: row.id }),
      },
      {
        label: 'Delete team',
        icon: <Trash2 className="size-4" />,
        onSelect: () => run(deleteCrewAction, { id: row.id }),
        danger: true,
        separated: true,
      },
    ],
  }));

  return (
    <ResourceView
      module="crews"
      view={view}
      items={items}
      badgeHeader="Mode"
      columns={3}
      empty={{
        icon: Bot,
        title: 'No bot teams yet',
        description:
          'A bot team is several personas working one task together — as a pipeline, a fan-out, or with one persona delegating to the others. Create one with the form beside this list.',
      }}
    />
  );
}
