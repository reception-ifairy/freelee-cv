import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts, users } from '@/db/schema';
import { formatDate, truncate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on building with AI personas, prompt design and product updates.',
};

export const revalidate = 300;

export default async function BlogIndexPage() {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      readingMinutes: posts.readingMinutes,
      authorName: users.name,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.isPublished, true))
    .orderBy(desc(posts.publishedAt));

  return (
    <>
      <section className="border-b border-slate-200 dark:border-slate-800">
        <div className="container-app py-14">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Blog</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Notes on building with AI personas, prompt design and what we are shipping.
          </p>
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
                  <p className="text-xs text-slate-400">
                    {formatDate(post.publishedAt)} · {post.readingMinutes} min read
                  </p>
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
              No posts published yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
