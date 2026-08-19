'use client';

import { Copy, Eye, EyeOff, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { PersonaMark } from '@/components/site/persona-mark';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import {
  deletePersonaAction, duplicatePersonaAction, togglePersonaAction,
} from '@/server/actions/admin';

export type PersonaRow = {
  id: number;
  slug: string;
  name: string;
  expertise: string | null;
  accentColor: string;
  /** Taxonomy, for the mark. Null is normal — an unfiled persona still gets one. */
  categoryId: number | null;
  categorySlug: string | null;
  categoryColor: string | null;
  sectorSlug: string | null;
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
      // The same generated mark the public card uses. An admin looking at a
      // list of specialists should see the same identities the catalogue does,
      // not a second scheme that drifts from it.
      <PersonaMark
        personaKey={row.slug}
        categoryKey={row.categorySlug}
        sectorKey={row.sectorSlug}
        categoryIndex={row.categoryId}
        accent={row.categoryColor ?? row.accentColor}
        className="size-9"
      />
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

  return <ResourceView module="personas" view={view} items={items} empty={{ icon: Sparkles, title: 'No personas match', description: 'Personas are the AI specialists visitors chat with. Clear the filters, or create one — you can also convert an existing bot from a document.', action: { label: 'New persona', href: '/admin/personas/new' } }} columns={4} showCount={false} />;
}
