'use client';

import { CornerDownRight, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deleteMenuItemAction } from '@/server/actions/admin';
import { BlockIcon } from '@/components/ui/block-icon';

export type MenuItemRow = {
  id: number;
  label: string;
  href: string;
  visibleTo: string;
  isActive: boolean;
  icon: string | null;
  description: string | null;
  depth: 0 | 1;
  parentLabel: string | null;
};

export function MenusList({ rows, view }: { rows: MenuItemRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.label,
    subtitle: row.description ?? row.href,
    media:
      row.depth === 1 ? (
        // Children are drawn with the same indent marker in both views, so the
        // shape of the menu survives the switch from list to grid.
        <span className="flex items-center gap-1 text-slate-300 dark:text-slate-600">
          <CornerDownRight className="size-3.5" />
          {row.icon ? <BlockIcon name={row.icon} className="size-3.5" /> : null}
        </span>
      ) : row.icon ? (
        <BlockIcon name={row.icon} className="size-4 text-slate-400" />
      ) : undefined,
    badges: [
      { label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      { label: row.visibleTo, tone: 'slate' as const },
      ...(row.depth === 1 && row.parentLabel ? [{ label: `under ${row.parentLabel}`, tone: 'brand' as const }] : []),
    ],
    meta: [
      { label: 'Link', value: row.href },
      { label: 'Level', value: row.depth === 0 ? 'Top level' : 'In a dropdown' },
    ],
    actions: [
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteMenuItemAction, { id: row.id }), danger: true },
    ],
  }));

  return <ResourceView module="menus" view={view} items={items} empty="No items in this location." columns={3} />;
}
