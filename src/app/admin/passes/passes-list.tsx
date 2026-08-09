'use client';

import { Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deletePassProductAction } from '@/server/actions/admin-billing';

export type PassRow = {
  id: number;
  name: string;
  key: string;
  duration: string;
  price: string;
  isActive: boolean;
  isPublic: boolean;
};

export function PassesList({ rows, view }: { rows: PassRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.key,
    badges: [
      { label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      ...(row.isPublic ? [{ label: 'Public', tone: 'brand' as const }] : []),
    ],
    meta: [
      { label: 'Duration', value: row.duration },
      { label: 'Price', value: row.price },
    ],
    actions: [{ label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePassProductAction, { id: row.id }), danger: true }],
  }));

  return <ResourceView module="passes" view={view} items={items} empty="No passes yet." columns={2} />;
}
