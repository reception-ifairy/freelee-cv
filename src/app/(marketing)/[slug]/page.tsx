import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pages } from '@/db/schema';
import { Markdown } from '@/components/site/markdown';
import { truncate } from '@/lib/utils';

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

  return (
    <div className="container-app py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
        <div className="mt-8">
          <Markdown>{page.content}</Markdown>
        </div>
      </div>
    </div>
  );
}
