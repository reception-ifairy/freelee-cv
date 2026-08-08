import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function CategoriesSection() {
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
      </div>
    </section>
  );
}
