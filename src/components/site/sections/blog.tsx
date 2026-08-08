import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { formatDate, truncate } from '@/lib/utils';
import { getFrontendT } from '@/lib/i18n/translate';

export async function BlogSection() {
  const [latestPosts, { t }] = await Promise.all([
    db.select().from(posts).where(eq(posts.isPublished, true)).orderBy(desc(posts.publishedAt)).limit(3),
    getFrontendT(),
  ]);

  if (latestPosts.length === 0) return null;

  return (
    <section className="container-app pb-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.blog_title', 'From the blog')}</h2>
        <Link href="/blog" className="text-sm font-semibold text-brand-600 hover:underline">
          {t('home.blog_all', 'All posts →')}
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {latestPosts.map((post) => (
          <article
            key={post.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="aurora h-40 w-full" />
            <div className="p-5">
              <p className="text-xs text-slate-400">
                {formatDate(post.publishedAt)} · {t('home.min_read', '{minutes} min read', { minutes: post.readingMinutes })}
              </p>
              <h3 className="mt-2 font-semibold leading-snug">
                <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {truncate(post.excerpt, 120)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
