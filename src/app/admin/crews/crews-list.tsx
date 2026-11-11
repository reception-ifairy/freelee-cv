'use client';

import { Bot, Pencil, Play, Power, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { modeCopy, runOutcome } from '@/modules/crews/labels';
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
  lastRunStopReason: string | null;
  projectName: string | null;
};

export function CrewsList({ rows, view }: { rows: CrewRowData[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => {
    const last = row.lastRunStatus ? runOutcome(row.lastRunStatus, row.lastRunStopReason) : null;
    return {
      id: row.id,
      title: row.name,
      subtitle: row.description,
      href: `/admin/crews/${row.id}`,
      badges: [
        // Stored as `sequential`/`parallel`/`supervisor`; shown as what they
        // mean. One vocabulary for the whole feature — see labels.ts.
        { label: modeCopy(row.mode).label, tone: 'brand' as const },
        ...(row.isActive ? [] : [{ label: 'Switched off', tone: 'slate' as const }]),
        ...(row.projectName ? [{ label: row.projectName, tone: 'slate' as const }] : []),
        ...(last ? [{ label: `Last run: ${last.label.toLowerCase()}`, tone: last.tone, title: last.sentence }] : []),
      ],
      meta: [
        { label: 'Bots', value: String(row.memberCount) },
        { label: 'Runs', value: String(row.runCount) },
      ],
      actions: [
        { label: 'Edit team', href: `/admin/crews/${row.id}`, icon: <Pencil className="size-4" /> },
        { label: 'Test run', href: `/admin/crews/${row.id}?tab=runs`, icon: <Play className="size-4" /> },
        {
          label: row.isActive ? 'Switch off' : 'Switch on',
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
    };
  });

  return (
    <ResourceView
      module="crews"
      view={view}
      items={items}
      badgeHeader="How they work"
      columns={3}
      empty={{
        icon: Bot,
        title: 'No bot teams yet',
        description: 'A bot team is a few bots that work on one task together, so you get a finished result instead of one answer.',
        action: { label: 'New bot team', href: '/admin/crews/new' },
      }}
    />
  );
}
