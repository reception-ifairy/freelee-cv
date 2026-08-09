'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deletePackAction } from '@/server/actions/admin';

export type PackRow = {
  id: number;
  name: string;
  price: string;
  credits: string;
  bonusCredits: number;
  orderCount: number;
  isActive: boolean;
};

export function PacksList({ rows, view }: { rows: PackRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.bonusCredits > 0 ? `+${row.bonusCredits.toLocaleString('en-GB')} bonus credits` : null,
    href: `/admin/packs/${row.id}`,
    badges: [{ label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) }],
    meta: [
      { label: 'Price', value: row.price },
      { label: 'Credits', value: row.credits },
      { label: 'Orders', value: row.orderCount },
    ],
    actions: [
      { label: 'Edit', href: `/admin/packs/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePackAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="packs" view={view} items={items} empty="No credit packs yet." columns={3} />;
}
