import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { CalendarDays, Clock, Filter, Newspaper } from 'lucide-react';
import { db } from '@/db';
import { posts, users, categories } from '@/db/schema';
import { publiclyVisible } from '@/lib/blog/visibility';
import { getFrontendT } from '@/lib/i18n/translate';
import { helpTopics } from '@/lib/help/topics';
import { HelpTip } from '@/components/ui/help-tip';
import { formatDate, truncate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on building with AI personas, prompt design and product updates.',
};

export const revalidate = 300;

type SearchParams = Promise<{ category?: string }>;

export default async function BlogIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { t } = await getFrontendT();
  const help = helpTopics(t);

  // Only categories that actually have a published post — an empty filter
  // option is worse than no option.
  const categoryRows = await db
    .select({ slug: categories.slug, name: categories.name, count: sql<number>`count(${posts.id})::int` })
    .from(categories)
    .innerJoin(posts, and(eq(posts.categoryId, categories.id), publiclyVisible()))
    .groupBy(categories.slug, categories.name, categories.position)
    .orderBy(asc(categories.position));

  const active = categoryRows.find((c) => c.slug === params.category);

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      readingMinutes: posts.readingMinutes,
      authorName: users.name,
      categoryName: categories.name,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(active ? and(publiclyVisible(), eq(categories.slug, active.slug)) : publiclyVisible())
    .orderBy(desc(posts.publishedAt));

  return (
    <>
      <section className="border-b border-slate-200 dark:border-slate-800">
        <div className="container-app py-14">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Newspaper className="size-5" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('blog.title', 'Blog')}</h1>
          </div>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {t('blog.subtitle', 'Notes on building with AI personas, prompt design and what we are shipping.')}
          </p>

          {categoryRows.length > 0 ? (
            <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="category" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('blog.filter_category', 'Category')}
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue={params.category ?? ''}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">{t('blog.filter_all_categories', 'All categories')}</option>
                  {categoryRows.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
              >
                <Filter className="size-4" />
                {t('blog.filter_apply', 'Filter')}
              </button>
              {active ? (
                <Link href="/blog" className="h-10 leading-10 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                  {t('blog.filter_clear', 'Clear')}
                </Link>
              ) : null}
            </form>
          ) : null}
        </div>
      </section>

      <section className="container-app py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((post) => (
              <article
                key={post.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="aurora h-44 w-full" />
                <div className="flex flex-1 flex-col p-5">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(post.publishedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {t('blog.read_time', '{minutes} min read', { minutes: post.readingMinutes })}
                    </span>
                  </p>
                  {post.categoryName ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {post.categoryName}
                    </p>
                  ) : null}
                  <h2 className="mt-2 font-semibold leading-snug">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-500 dark:text-slate-400">
                    {truncate(post.excerpt, 160)}
                  </p>
                  {post.authorName ? (
                    <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                      {post.authorName}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
              {active
                ? t('blog.empty_filtered', 'No posts in this category yet.')
                : t('blog.empty', 'No posts published yet.')}
            </p>
          )}
        </div>

        {rows.length > 0 ? (
          <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-slate-400">
            {t('blog.read_time_note', 'Reading times are estimates.')}
            <HelpTip title={help['blog.reading'].title} body={help['blog.reading'].body} />
          </p>
        ) : null}
      </section>
    </>
  );
}
