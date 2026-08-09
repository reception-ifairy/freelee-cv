import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { CalendarDays } from 'lucide-react';
import { db } from '@/db';
import { pages, pageSections } from '@/db/schema';
import { Markdown } from '@/components/site/markdown';
import { BlockRenderer } from '@/components/site/block-renderer';
import { EditorStudio } from '@/components/site/editor-studio';
import type { EditableBlock } from '@/components/site/editor-types';
import { currentUser } from '@/lib/auth';
import { getFrontendT } from '@/lib/i18n/translate';
import { formatDate, truncate } from '@/lib/utils';

type Params = Promise<{ slug: string }>;

async function loadPage(slug: string) {
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.isPublished, true)))
    .limit(1);

  return page ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: 'Page not found' };

  return {
    title: page.metaTitle ?? page.title,
    description: truncate(page.metaDescription, 158),
    robots: page.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function CmsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();
  const { t } = await getFrontendT();

  // Blocks take over only when the page is switched to the builder AND has at
  // least one block. The second half of that condition is what stops a page
  // going blank the moment someone flips the toggle — the markdown is still
  // there, so it keeps showing until there is something to replace it.
  const blocks = page.useBuilder
    ? await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.page, 'page'), eq(pageSections.pageId, page.id)))
        .orderBy(asc(pageSections.position))
    : [];

  const user = await currentUser();
  const canEdit = user?.isAdmin === true;
  const scope = { page: 'page', pageId: page.id };

  // The builder appears whenever an admin is on a page that uses blocks, so
  // there is no separate "go to the editor" step.
  if (blocks.length > 0 || (canEdit && page.useBuilder)) {
    const editable: EditableBlock[] = blocks
      .filter((row) => row.parentId == null)
      .map((row) => ({
        id: row.id,
        type: row.type,
        isVisible: row.isVisible,
        config: (row.config ?? {}) as Record<string, unknown>,
        layout: row.layout,
        parentId: row.parentId ?? null,
      }));

    return (
      <div className="py-6">
        <div className="container-app">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
        </div>
        <BlockRenderer rows={blocks} canEdit={canEdit} scope={scope} />
        {canEdit ? <EditorStudio blocks={editable} scope={scope} adminHref={`/admin/pages/${page.id}/builder`} /> : null}
      </div>
    );
  }

  return (
    <div className="container-app py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
        {page.updatedAt ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays className="size-4" />
            {t('pages.last_updated', 'Last updated {date}', { date: formatDate(page.updatedAt, 'long') })}
          </p>
        ) : null}
        <div className="mt-8">
          <Markdown>{page.content}</Markdown>
        </div>
      </div>
    </div>
  );
}
