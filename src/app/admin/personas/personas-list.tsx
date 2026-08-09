'use client';

import { Copy, Pencil, Star, Trash2, Eye, EyeOff } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import {
  deletePersonaAction, duplicatePersonaAction, togglePersonaAction,
} from '@/server/actions/admin';

export type PersonaRow = {
  id: number;
  name: string;
  expertise: string | null;
  accentColor: string;
  initials: string;
  model: string;
  messages: string;
  isActive: boolean;
  isFeatured: boolean;
};

export function PersonasList({ rows, view }: { rows: PersonaRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.expertise,
    href: `/admin/personas/${row.id}`,
    media: (
      <span
        className="grid size-9 place-items-center rounded-lg text-xs font-bold text-white"
        style={{ background: row.accentColor }}
      >
        {row.initials}
      </span>
    ),
    badges: [
      { label: row.isActive ? 'Published' : 'Draft', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      ...(row.isFeatured ? [{ label: 'Featured', tone: 'amber' as const }] : []),
    ],
    meta: [
      { label: 'Model', value: row.model },
      { label: 'Messages', value: row.messages },
    ],
    actions: [
      { label: 'Edit', href: `/admin/personas/${row.id}`, icon: <Pencil className="size-4" /> },
      {
        label: row.isActive ? 'Unpublish' : 'Publish',
        icon: row.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />,
        onSelect: () => run(togglePersonaAction, { id: row.id, field: 'isActive' }),
        separated: true,
      },
      {
        label: row.isFeatured ? 'Remove from featured' : 'Mark as featured',
        icon: <Star className="size-4" />,
        onSelect: () => run(togglePersonaAction, { id: row.id, field: 'isFeatured' }),
      },
      {
        label: 'Duplicate',
        icon: <Copy className="size-4" />,
        onSelect: () => run(duplicatePersonaAction, { id: row.id }),
      },
      {
        label: 'Delete',
        icon: <Trash2 className="size-4" />,
        onSelect: () => run(deletePersonaAction, { id: row.id }),
        danger: true,
        separated: true,
      },
    ],
  }));

  return <ResourceView module="personas" view={view} items={items} empty="No personas yet." columns={4} />;
}
