import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { Markdown } from '@/components/site/markdown';
import { getFrontendT } from '@/lib/i18n/translate';
import { formatDate, truncate } from '@/lib/utils';

type Params = Promise<{ slug: string }>;

async function loadPost(slug: string) {
  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      metaTitle: posts.metaTitle,
      metaDescription: posts.metaDescription,
      publishedAt: posts.publishedAt,
      readingMinutes: posts.readingMinutes,
      categoryId: posts.categoryId,
      authorName: users.name,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.slug, slug), eq(posts.isPublished, true)))
    .limit(1);

  return post ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: 'Post not found' };

  return {
    title: post.metaTitle ?? post.title,
    description: truncate(post.metaDescription ?? post.excerpt, 158),
    openGraph: { type: 'article', title: post.title },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();
  const { t } = await getFrontendT();

  // Incremented in SQL so concurrent readers cannot clobber each other's count.
  // Fire-and-forget: a failed counter must never break the page.
  void db
    .update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(eq(posts.id, post.id))
    .catch(() => undefined);

  const related = post.categoryId
    ? await db
        .select({ title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(eq(posts.isPublished, true), eq(posts.categoryId, post.categoryId), ne(posts.id, post.id)))
        .orderBy(desc(posts.publishedAt))
        .limit(3)
    : [];

  return (
    <>
      <article className="container-app py-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
            <ArrowLeft className="size-4" />
            {t('blog.back', 'Back to blog')}
          </Link>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{post.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {post.authorName ? <span>{post.authorName}</span> : null}
            <time dateTime={post.publishedAt?.toISOString()} className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDate(post.publishedAt, 'long')}
            </time>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {t('blog.read_time', '{minutes} min read', { minutes: post.readingMinutes })}
            </span>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Markdown>{post.content}</Markdown>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="container-app pb-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-xl font-bold tracking-tight">{t('blog.keep_reading', 'Keep reading')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/blog/${item.slug}`}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-xs text-slate-400">{formatDate(item.publishedAt)}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
