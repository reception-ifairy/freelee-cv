'use client';

import { ChevronDown, Eye, EyeOff, Images, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import {
  deleteShowcaseItemAction, moveShowcaseItemAction, toggleShowcaseItemAction,
} from '@/server/actions/admin-showcase';

export type ShowcaseRow = {
  id: number;
  title: string;
  caption: string | null;
  mediaUrl: string;
  personaName: string | null;
  hasPrompt: boolean;
  showPrompt: boolean;
  isVisible: boolean;
};

export function ShowcaseList({ rows, view }: { rows: ShowcaseRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    subtitle: row.caption,
    media: (
      // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, same convention as persona avatars
      <img src={row.mediaUrl} alt="" className="size-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
    ),
    badges: [
      { label: row.isVisible ? 'Live' : 'Hidden', tone: row.isVisible ? ('green' as const) : ('slate' as const) },
      ...(row.personaName ? [{ label: row.personaName, tone: 'slate' as const }] : []),
      // Makes it obvious at a glance when a real customer prompt is being
      // published, rather than something to discover on the live page.
      ...(row.hasPrompt && row.showPrompt ? [{ label: 'Prompt shown', tone: 'amber' as const }] : []),
    ],
    meta: [{ label: 'Order', value: index + 1 }],
    actions: [
      { label: 'Move up', icon: <ChevronDown className="size-4 rotate-180" />, disabled: index === 0, onSelect: () => run(moveShowcaseItemAction, { id: row.id, direction: 'up' }) },
      { label: 'Move down', icon: <ChevronDown className="size-4" />, disabled: index === rows.length - 1, onSelect: () => run(moveShowcaseItemAction, { id: row.id, direction: 'down' }) },
      {
        label: row.isVisible ? 'Hide from the site' : 'Show on the site', separated: true,
        icon: row.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />,
        onSelect: () => run(toggleShowcaseItemAction, { id: row.id, isVisible: String(row.isVisible) }),
      },
      { label: 'Delete', icon: <Trash2 className="size-4" />, danger: true, separated: true, onSelect: () => run(deleteShowcaseItemAction, { id: row.id }) },
    ],
  }));

  return <ResourceView module="showcase" view={view} items={items} empty={{ icon: Images, title: 'Nothing in the showcase', description: 'Curated images your personas produced, shown on the public site. Promote one from a conversation, or add it by hand.' }} columns={4} />;
}
