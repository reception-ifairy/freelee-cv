import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import { db } from '@/db';
import { categories, personaCategories } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { getFrontendT } from '@/lib/i18n/translate';

export async function CategoriesSection() {
  const { t } = await getFrontendT();
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      color: categories.color,
      count: sql<number>`count(${personaCategories.personaId})::int`,
    })
    .from(categories)
    .leftJoin(personaCategories, eq(personaCategories.categoryId, categories.id))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(categories.position)
    .limit(12);

  if (categoryRows.length === 0) return null;

  return (
    <section className="container-app pb-6">
      <p className="mb-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {t('home.categories_title', 'Browse by category')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {categoryRows.map((category) => (
          <Link
            key={category.id}
            href={`/personas?category=${category.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-500/10"
          >
            <span className="size-2 rounded-full" style={{ background: category.color ?? '#6366f1' }} />
            {category.name}
            <span className="text-xs text-slate-400">{category.count}</span>
          </Link>
        ))}
        <Link
          href="/personas"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          {t('home.categories_all', 'All categories')}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
