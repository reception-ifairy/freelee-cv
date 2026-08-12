'use client';

import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deleteModifierAction } from '@/server/actions/admin';

export type ModifierRow = {
  id: number;
  name: string;
  value: string;
  isDefault: boolean;
  isActive: boolean;
};

export function ModifiersList({ rows, view, kind }: { rows: ModifierRow[]; view: AdminView; kind: string }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.value,
    badges: [
      ...(row.isDefault ? [{ label: 'Default', tone: 'brand' as const }] : []),
      { label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) },
    ],
    actions: [
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteModifierAction, { id: row.id }), danger: true },
    ],
  }));

  // The whole point of a modifier is its instruction text, so the card shows it
  // as the subtitle rather than hiding it behind a click.
  return <ResourceView module={`modifiers-${kind}`} view={view} items={items} empty={{ icon: SlidersHorizontal, title: `No ${kind} modifiers`, description: 'Modifiers are reusable instruction fragments layered onto a persona\'s system prompt — a tone, a format, a constraint.' }} columns={2} />;
}
