'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plug } from 'lucide-react';
import { ResourceView, type BadgeTone, type ResourceItem } from '@/components/admin/resource-view';
import { HEALTH_LABEL, hrefForConnectionsHash, type ConnectionHealth } from '@/lib/admin/connection-groups';

export type IntegrationRow = {
  id: string;
  title: string;
  description: string;
  group: string;
  health: ConnectionHealth;
  tested: string | null;
  /** The connection's own card (Save → Test → Fetch), built on the server with its actions bound. */
  card: React.ReactNode;
};

const TONE: Record<ConnectionHealth, BadgeTone> = { working: 'green', failing: 'rose', untested: 'amber', off: 'slate' };

/**
 * Settings → Integrations (freelee #93): the connections of one group — or
 * all — as the taxonomy's list, each opening its card in the sheet. The
 * groups are Settings' own sections, so this list has no rail of its own.
 *
 * Old links to /admin/connections#conn-<id> redirect here with their hash
 * (a browser keeps the fragment across a redirect); the hash is turned into
 * the card it pointed at.
 */
export function IntegrationsList({ rows, showGroup, before }: { rows: IntegrationRow[]; showGroup: boolean; before: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const target = hrefForConnectionsHash(window.location.hash);
    if (target) router.replace(target, { scroll: false });
  }, [router]);

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.description,
    badges: [{ label: HEALTH_LABEL[row.health], tone: TONE[row.health] }],
    meta: [
      ...(showGroup ? [{ label: 'Group', value: row.group }] : []),
      { label: 'Last test', value: row.tested ?? '—' },
    ],
    detail: row.card,
  }));

  return (
    <ResourceView
      module="integrations"
      view="list"
      browser={{ hideRail: true, railLabel: 'Health', before }}
      items={items}
      badgeHeader="Health"
      empty={{ icon: Plug, title: 'Nothing in this group' }}
    />
  );
}
