'use client';

import { Layers, Pencil, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { MeterGroup } from '@/components/ui/meter';
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
    // the row.
    //
    // The three suitability scores were one string — `"70 / 40 / 20"`. They are
    // 0–100 values that exist *only* to be compared with each other, and three
    // bars on a shared scale answer "which audience is this sector for" without
    // reading a single digit.
    meta: [
      {
        label: 'Suitability',
        value: (
          <MeterGroup
            items={[
              { label: 'B2C', value: row.b2cSuitability },
              { label: 'B2B', value: row.b2bSuitability, tone: 'emerald' },
              { label: 'B2G', value: row.b2gSuitability, tone: 'amber' },
            ]}
          />
        ),
      },
    ],
    actions: [
      { label: 'Edit', href: `/admin/sectors/${row.id}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteSectorAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="sectors" view={view} items={items} empty={{ icon: Layers, title: 'No sectors here', description: 'Sectors group personas by the industry they serve, and drive the B2C/B2B/B2G suitability scores. Clear the filters, or add one.', action: { label: 'New sector', href: '/admin/sectors/new' } }} columns={4} showCount={false} />;
}
