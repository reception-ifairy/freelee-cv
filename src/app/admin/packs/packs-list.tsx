'use client';

import { Package, Pencil, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';
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

  const topOrders = Math.max(1, ...rows.map((r) => r.orderCount));

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.bonusCredits > 0 ? `+${row.bonusCredits.toLocaleString('en-GB')} bonus credits` : null,
    href: `/admin/packs/${row.id}`,
    badges: [{ label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) }],
    meta: [
      { label: 'Price', value: row.price },
      { label: 'Credits', value: row.credits },
      // Which pack actually sells is the question this screen answers, and it
      // was an integer indistinguishable from the price beside it.
      { label: 'Orders', value: <Meter value={row.orderCount} max={topOrders} tone="emerald" display={row.orderCount.toLocaleString('en-GB')} label="Orders" /> },
    ],
    actions: [
      { label: 'Edit', href: `/admin/packs/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePackAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="packs" view={view} items={items} empty={{ icon: Package, title: 'No credit packs', description: 'Packs are the one-off credit bundles customers buy. Create one with the form beside this list.' }} columns={3} />;
}
