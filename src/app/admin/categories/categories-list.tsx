'use client';

import { Pencil, Tags, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deleteCategoryAction } from '@/server/actions/admin';

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
  count: number;
};

export function CategoriesList({ rows, view }: { rows: CategoryRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const topCount = Math.max(1, ...rows.map((r) => r.count));

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: `/${row.slug}`,
    href: `/admin/categories/${row.id}`,
    // Was a size-3 dot — technically media, visually negligible next to the
    // size-9 avatars every other list uses. The colour is the thing that
    // identifies a category on the public site, so it gets real estate.
    media: (
      <span
        className="block size-9 rounded-xl border border-white/10"
        style={{ background: row.color ?? '#6366f1' }}
        aria-hidden
      />
    ),
    badges: [{ label: row.isActive ? 'Active' : 'Hidden', tone: row.isActive ? ('green' as const) : ('slate' as const) }],
    // A distribution, previously rendered as a lone integer — so "3" gave no
    // sense of whether that was most of the catalogue or almost none of it.
    meta: [{ label: 'Personas', value: <Meter value={row.count} max={topCount} display={row.count.toLocaleString('en-GB')} label="Personas" /> }],
    actions: [
      { label: 'Edit', href: `/admin/categories/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteCategoryAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="categories" view={view} items={items} empty={{ icon: Tags, title: 'No categories yet', description: 'Categories group personas on the public marketplace and drive the suggested toolset for a new persona.', action: { label: 'New category', href: '/admin/categories/new' } }} columns={4} />;
}
