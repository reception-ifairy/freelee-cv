import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { db } from '@/db';
import { pages, pageSections } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { BlockList } from '@/components/admin/block-list';
import type { BlockCardRow } from '@/components/admin/block-card';
import { setPageBuilderAction } from '@/server/actions/admin-frontpage';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page builder' };

export default async function PageBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) notFound();

  const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!page) notFound();

  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'page'), eq(pageSections.pageId, pageId)))
    .orderBy(asc(pageSections.position));

  const blocks: BlockCardRow[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    isVisible: row.isVisible,
    config: (row.config ?? {}) as Record<string, unknown>,
    layout: row.layout,
    parentId: row.parentId,
  }));

  return (
    <div>
      <PageHeader
        title={page.title}
        description="Build this page from blocks, the same way as the home page."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/pages"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="size-3.5" /> All pages
            </Link>
            <Link
              href={`/${page.slug}`}
              target="_blank"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ExternalLink className="size-3.5" /> View page
            </Link>
          </div>
        }
      />

      <div className="mb-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <form action={setPageBuilderAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="useBuilder" value={String(!page.useBuilder)} />
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">This page renders from</p>
            <Badge tone={page.useBuilder ? 'brand' : 'slate'}>{page.useBuilder ? 'blocks' : 'the text field'}</Badge>
            <HelpTip
              title="Blocks or text?"
              body="Switching to blocks does not delete anything — your original text is kept, and switching back restores it exactly. A page set to blocks that has no blocks yet still shows the text, so it can never go blank on a visitor."
            />
          </div>
          <button
            type="submit"
            className="ml-auto h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {page.useBuilder ? 'Go back to the text field' : 'Switch to blocks'}
          </button>
        </form>

        {page.useBuilder && blocks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            No blocks yet, so visitors still see the original text. Add a block below and it takes over.
          </p>
        ) : null}
      </div>

      <BlockList rows={blocks} scope={{ page: 'page', pageId: page.id }} />
    </div>
  );
}
