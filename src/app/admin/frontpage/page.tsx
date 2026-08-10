import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ExternalLink } from 'lucide-react';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { BlockList } from '@/components/admin/block-list';
import { PagePreview } from '@/components/admin/page-preview';
import type { BlockCardRow } from '@/components/admin/block-card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Frontpage' };

export default async function FrontpagePage() {
  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'home'), isNull(pageSections.pageId), isNull(pageSections.postId)))
    .orderBy(asc(pageSections.position));

  const blocks: BlockCardRow[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    isVisible: row.isVisible,
    config: (row.config ?? {}) as Record<string, unknown>,
    layout: row.layout,
    parentId: row.parentId,
  }));

  /**
   * Changes whenever anything the page renders from changes, so the preview
   * reloads on its own. `updatedAt` is in it because editing a block's *text*
   * changes nothing about the list itself — without it the preview would keep
   * showing the old copy after a save.
   */
  const reloadKey = rows
    .map((row) => `${row.id}:${row.position}:${row.isVisible}:${row.updatedAt.getTime()}`)
    .join('|');

  return (
    <div>
      <PageHeader
        title="Frontpage"
        description="Drag blocks to reorder, open one to edit its content and layout. The preview beside it is the real page. See docs/33-block-builder.md."
        actions={
          <Link
            href="/"
            target="_blank"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ExternalLink className="size-3.5" /> Edit on the page
          </Link>
        }
      />

      {/* Side by side on a wide screen, stacked below it: the preview is
          useless at 380px and the block list is what you actually work in. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <BlockList rows={blocks} scope={{ page: 'home' }} />

        <div className="sticky top-6 hidden h-[calc(100vh-8rem)] xl:block">
          <PagePreview src="/" reloadKey={reloadKey} />
        </div>
      </div>
    </div>
  );
}
