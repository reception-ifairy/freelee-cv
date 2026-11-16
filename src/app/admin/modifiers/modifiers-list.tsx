'use client';

import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { ResourceView, type BrowserRailLink, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { deleteModifierAction } from '@/server/actions/admin';

export type ModifierRow = {
  id: number;
  name: string;
  value: string;
  isDefault: boolean;
  isActive: boolean;
};

export function ModifiersList({ rows, kind, rail, form }: { rows: ModifierRow[]; kind: string; rail: BrowserRailLink[]; form: React.ReactNode }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.value,
    badges: [
      { label: row.isActive ? 'Active' : 'Off', tone: row.isActive ? ('green' as const) : ('slate' as const) },
      ...(row.isDefault ? [{ label: 'Default', tone: 'brand' as const }] : []),
    ],
    // The instruction is the modifier; the card shows it whole.
    meta: [{ key: 'instruction', label: 'Instruction', value: row.value, cardOnly: true }],
    actions: [
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deleteModifierAction, { id: row.id }), danger: true },
    ],
  }));

  // The taxonomy browser's layout (#90): the five types on the left, a dense
  // table, the whole instruction on the row's card. The subtitle keeps the
  // first line of it in the table.
  return <ResourceView module={`modifiers-${kind}`} view="list" browser={{ rail, railLabel: 'Types', before: form }} items={items} empty={{ icon: SlidersHorizontal, title: `No ${kind} modifiers`, description: 'Modifiers are reusable instruction fragments layered onto a persona\'s system prompt — a tone, a format, a constraint.' }} columns={2} />;
}
