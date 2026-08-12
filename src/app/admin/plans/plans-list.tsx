'use client';

import { RefreshCw, Trash2 } from 'lucide-react';
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
    // No Edit action: unlike packs, plans and passes have no [id] route to
    // edit them in — they are created from the form beside this list and then
    // deleted and re-made. A real editor is a feature, not a visual fix, so
    // this list does not offer a link that would go nowhere.
    actions: [{ label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePlanAction, { id: row.id }), danger: true }],
  }));

  return <ResourceView module="plans" view={view} items={items} empty={{ icon: RefreshCw, title: 'No subscription plans', description: 'Plans bill a team on a repeating cycle and top its wallet up each period. Create one with the form beside this list.' }} columns={2} />;
}
