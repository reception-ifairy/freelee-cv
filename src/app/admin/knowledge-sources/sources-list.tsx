'use client';

import { Search } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { SourceCard, type SourceCardData } from './source-card';

/**
 * External sources in the taxonomy's layout (freelee #92): Active / Off on the
 * left, one row per source, and its card — the whole Save → Test editor — in
 * the sheet. Until #92 every source was an open editor stacked down the page.
 */
export function SourcesList({ sources, form }: { sources: SourceCardData[]; form: React.ReactNode }) {
  const items: ResourceItem[] = sources.map((source) => ({
    id: source.id,
    title: source.label,
    subtitle: `${source.baseUrl}${source.path}`,
    badges: [
      { label: source.isActive ? 'Active' : 'Off', tone: source.isActive ? ('green' as const) : ('slate' as const) },
      ...(source.hasApiKey ? [] : [{ label: 'No key', tone: 'amber' as const }]),
    ],
    meta: [{ label: 'Key', value: <span className="font-mono text-xs">{source.key}</span> }],
    detail: <SourceCard source={source} />,
  }));

  return (
    <ResourceView
      module="knowledge-sources"
      view="list"
      browser={{ groups: ['Active', 'Off'], railLabel: 'Status', before: form }}
      items={items}
      empty={{
        icon: Search,
        title: 'No knowledge sources',
        description:
          'A knowledge source is an external search API a persona can cite from. Add one with the form above — the response mapping is dot-paths, so most simple REST search APIs work without code.',
      }}
    />
  );
}
