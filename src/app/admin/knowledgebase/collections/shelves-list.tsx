'use client';

import { Layers } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';

export type ShelfRow = {
  id: number;
  key: string;
  label: string;
  description: string | null;
  documents: number;
  passages: number;
  fromFolder: boolean;
  isActive: boolean;
};

/** Shelves in the taxonomy's layout (freelee #92): On / Off on the left, the list, a card with what is on the shelf. */
export function ShelvesList({ rows, form }: { rows: ShelfRow[]; form: React.ReactNode }) {
  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.label,
    subtitle: row.description,
    badges: [
      { label: row.isActive ? 'On' : 'Off', tone: row.isActive ? ('green' as const) : ('amber' as const) },
      ...(row.fromFolder ? [{ label: 'from folder', tone: 'slate' as const, title: 'Created automatically from a folder name.' }] : []),
    ],
    meta: [
      { label: 'Documents', value: row.documents.toLocaleString('en-GB') },
      { label: 'Passages', value: row.passages.toLocaleString('en-GB') },
      // What a persona is granted by: set once from the name, never changed.
      { label: 'Address', value: <span className="font-mono text-xs">{row.key}</span>, cardOnly: true },
    ],
  }));

  return (
    <ResourceView
      module="shelves"
      view="list"
      browser={{ groups: ['On', 'Off'], railLabel: 'Status', before: form }}
      items={items}
      empty={{
        icon: Layers,
        title: 'No shelves yet',
        description: 'Make a folder inside the library and put books in it — the folder becomes a shelf the next time you scan.',
      }}
    />
  );
}
