import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ExternalLink } from 'lucide-react';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { BlockList } from '@/components/admin/block-list';
import type { BlockCardRow } from '@/components/admin/block-card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Frontpage' };

export default async function FrontpagePage() {
  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'home'), isNull(pageSections.pageId), isNull(pageSections.parentId)))
    .orderBy(asc(pageSections.position));

  const blocks: BlockCardRow[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    isVisible: row.isVisible,
    config: (row.config ?? {}) as Record<string, unknown>,
    layout: row.layout,
  }));

  return (
    <div>
      <PageHeader
        title="Frontpage"
        description="Drag blocks to reorder, open one to edit its content and layout. Changes appear on the live site immediately. See docs/33-block-builder.md."
        actions={
          <Link
            href="/"
            target="_blank"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ExternalLink className="size-3.5" /> View page
          </Link>
        }
      />

      <BlockList rows={blocks} scope={{ page: 'home' }} />
    </div>
  );
}
