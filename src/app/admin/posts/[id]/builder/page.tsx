import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { db } from '@/db';
import { posts, pageSections } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { BlockList } from '@/components/admin/block-list';
import type { BlockCardRow } from '@/components/admin/block-card';
import { setPostBuilderAction } from '@/server/actions/admin-frontpage';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Post builder' };

export default async function PostBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) notFound();

  const rows = await db
    .select()
    .from(pageSections)
    .where(and(eq(pageSections.page, 'post'), eq(pageSections.postId, postId)))
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
        title={post.title}
        description="Build this post's body from blocks instead of one long markdown field."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/posts"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="size-3.5" /> All posts
            </Link>
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ExternalLink className="size-3.5" /> View post
            </Link>
          </div>
        }
      />

      <div className="mb-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <form action={setPostBuilderAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="useBuilder" value={String(!post.useBuilder)} />
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">This post renders from</p>
            <Badge tone={post.useBuilder ? 'brand' : 'slate'}>{post.useBuilder ? 'blocks' : 'the text field'}</Badge>
            <HelpTip
              title="Blocks or text?"
              body="Switching does not delete anything — the written body is kept and switching back restores it exactly. A post set to blocks that has none yet still shows its text, so it can never go blank."
            />
          </div>
          <button
            type="submit"
            className="ml-auto h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {post.useBuilder ? 'Go back to the text field' : 'Switch to blocks'}
          </button>
        </form>

        {post.useBuilder && blocks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            No blocks yet, so readers still see the written body. Add a block below and it takes over.
          </p>
        ) : null}
      </div>

      <BlockList rows={blocks} scope={{ page: 'post', postId: post.id }} />
    </div>
  );
}
