'use client';

import { LayoutGrid, Pencil, PenLine, Trash2 } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deletePostAction } from '@/server/actions/admin';

export type PostRow = {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  isScheduled: boolean;
  publishedLabel: string;
  views: number;
  authorName: string | null;
  categoryName: string | null;
};

export function PostsList({ rows, view }: { rows: PostRow[]; view: AdminView }) {
  const { run } = useAdminAction();
  // One shared scale for every bar in this list — comparing rows against each
  // other is the whole point, and a per-row max would make them all full.
  const topViews = Math.max(1, ...rows.map((r) => r.views));

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: `/blog/${row.slug}`,
    href: `/admin/posts/${row.id}/builder`,
    badges: [
      // "Scheduled" is its own state: a future publish date used to be ignored
      // entirely, so calling it "Published" was untrue. See docs/33.
      row.isScheduled
        ? { label: 'Scheduled', tone: 'amber' as const }
        : { label: row.isPublished ? 'Published' : 'Draft', tone: row.isPublished ? ('green' as const) : ('slate' as const) },
      ...(row.categoryName ? [{ label: row.categoryName, tone: 'slate' as const }] : []),
    ],
    meta: [
      { label: 'Published', value: row.publishedLabel },
      // Selected, mapped into PostRow, and then never rendered.
      ...(row.authorName ? [{ label: 'Author', value: row.authorName }] : []),
      {
        label: 'Views',
        // Scaled against the best-performing post on the page, so "34 views"
        // stops being a number in isolation and becomes a position.
        value: <Meter value={row.views} max={topViews} display={row.views.toLocaleString('en-GB')} label="Views" />,
      },
    ],
    actions: [
      { label: 'Open block builder', href: `/admin/posts/${row.id}/builder`, icon: <LayoutGrid className="size-4" /> },
      { label: 'View on the site', href: `/blog/${row.slug}`, icon: <Pencil className="size-4" /> },
      { label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => run(deletePostAction, { id: row.id }), danger: true, separated: true },
    ],
  }));

  return <ResourceView module="posts" view={view} items={items} empty={{ icon: PenLine, title: 'No posts yet', description: 'Blog posts are written in the block builder and appear on the public /blog page once published.', action: { label: 'Write the first post', href: '/admin/posts' } }} columns={3} />;
}
