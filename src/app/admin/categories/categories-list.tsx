'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
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

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: `/${row.slug}`,
    href: `/admin/categories/${row.id}`,
    media: <span className="mt-1 block size-3 rounded-full" style={{ background: row.color ?? '#6366f1' }} />,
    badges: [{ label: row.isActive ? 'Active' : 'Hidden', tone: row.isActive ? ('green' as const) : ('slate' as const) }],
    meta: [{ label: 'Personas', value: row.count }],
    actions: [
      { label: 'Edit', href: `/admin/categories/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteCategoryAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="categories" view={view} items={items} empty="No categories yet." columns={4} />;
}
