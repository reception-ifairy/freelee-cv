'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deleteSectorAction } from '@/server/actions/admin';

export type SectorRow = {
  id: number;
  name: string;
  code: string | null;
  categoryName: string | null;
  b2cSuitability: number;
  b2bSuitability: number;
  b2gSuitability: number;
  isActive: boolean;
};

export function SectorsList({ rows, view }: { rows: SectorRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.code,
    href: `/admin/sectors/${row.id}`,
    badges: [
      { label: row.isActive ? 'Active' : 'Hidden', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      ...(row.categoryName ? [{ label: row.categoryName, tone: 'slate' as const }] : []),
    ],
    // Category is already a badge; repeating it as a truncated field just wastes
    // the row. The three suitability scores read as one field rather than three
    // columns — they are only ever compared with each other.
    meta: [
      { label: 'Suitability B2C / B2B / B2G', value: `${row.b2cSuitability} / ${row.b2bSuitability} / ${row.b2gSuitability}` },
    ],
    actions: [
      { label: 'Edit', href: `/admin/sectors/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteSectorAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="sectors" view={view} items={items} empty="No sectors yet." columns={4} />;
}
