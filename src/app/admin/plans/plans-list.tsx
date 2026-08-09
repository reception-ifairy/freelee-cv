'use client';

import { Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deletePlanAction } from '@/server/actions/admin-billing';

export type PlanRow = {
  id: number;
  name: string;
  subtitle: string;
  price: string;
  credits: string;
  isActive: boolean;
  isPublic: boolean;
};

export function PlansList({ rows, view }: { rows: PlanRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.subtitle,
    badges: [
      { label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      ...(row.isPublic ? [{ label: 'Public', tone: 'brand' as const }] : []),
    ],
    meta: [
      { label: 'Price', value: row.price },
      { label: 'Credits / cycle', value: row.credits },
    ],
    actions: [{ label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePlanAction, { id: row.id }), danger: true }],
  }));

  return <ResourceView module="plans" view={view} items={items} empty="No plans yet." columns={2} />;
}
