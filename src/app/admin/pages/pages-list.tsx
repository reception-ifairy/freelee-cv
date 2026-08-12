'use client';

import { ExternalLink, FileText, LayoutGrid, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deletePageAction } from '@/server/actions/admin';

export type PageRow = {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  isLocked: boolean;
  noindex: boolean;
  useBuilder: boolean;
  updatedLabel: string;
};

export function PagesList({ rows, view }: { rows: PageRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: `/${row.slug}`,
    href: `/admin/pages/${row.id}/builder`,
    badges: [
      { label: row.isPublished ? 'Published' : 'Draft', tone: row.isPublished ? ('green' as const) : ('slate' as const) },
      ...(row.useBuilder ? [{ label: 'Blocks', tone: 'brand' as const }] : []),
      ...(row.noindex ? [{ label: 'Hidden from search', tone: 'amber' as const }] : []),
      ...(row.isLocked ? [{ label: 'Locked', tone: 'slate' as const }] : []),
    ],
    // "Built from" used to sit here restating the `Blocks` badge two lines
    // above it, spending a column on information already on the card.
    meta: [{ label: 'Updated', value: row.updatedLabel }],
    actions: [
      { label: 'Open block builder', href: `/admin/pages/${row.id}/builder`, icon: <LayoutGrid className="size-4" /> },
      { label: 'View on the site', href: `/${row.slug}`, icon: <ExternalLink className="size-4" /> },
      // Locked pages are structural (terms, privacy) — the guard is in the
      // action too, this only avoids offering something that will be refused.
      {
        label: 'Delete',
        icon: <Trash2 className="size-4" />,
        onSelect: () => run(deletePageAction, { id: row.id }),
        danger: true,
        separated: true,
        disabled: row.isLocked,
      },
    ],
  }));

  return <ResourceView module="pages" view={view} items={items} empty={{ icon: FileText, title: 'No pages yet', description: 'Static pages — about, terms, contact — built with the same block builder as the frontpage.' }} columns={3} />;
}
