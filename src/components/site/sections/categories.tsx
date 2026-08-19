import Link from 'next/link';
import { and, eq, sql } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import { db } from '@/db';
import { categories, personas, personaCategories, sectors } from '@/db/schema';
import { PersonaMark } from '@/components/site/persona-mark';
import { getFrontendT } from '@/lib/i18n/translate';

/**
 * Categories, as showcases of what is possible.
 *
 * This was a row of pills: a 2px colour dot, a name and a count. It answered
 * "how many are there" — a question nobody asked — while the thing a visitor
 * actually wants to know is *what could this do for me*.
 *
 * Each card now carries the category's own mark (the same generator the persona
 * cards use, so a field and its specialists are visibly one family), the
 * specialisms inside it, and the names of real specialists doing the work.
 */
export async function CategoriesSection() {
  const { t } = await getFrontendT();

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      color: categories.color,
      // Correlated subqueries rather than joins: joining both persona_categories
      // and sectors at once multiplies rows, and every count comes back wrong —
      // the failure that made /admin/packs 500 and /admin/customers report zero.
      // The outer reference is qualified for the same reason.
      count: sql<number>`(select count(*)::int from persona_categories pc where pc.category_id = ${sql.raw('"categories"."id"')})`,
      sectorNames: sql<string[]>`(
        select coalesce(array_agg(s.name order by s.position), '{}')
          from (select name, position from sectors where category_id = ${sql.raw('"categories"."id"')} and is_active order by position limit 4) s
      )`,
      personaNames: sql<string[]>`(
        select coalesce(array_agg(x.name), '{}')
          from (select p.name from personas p
                  join persona_categories pc on pc.persona_id = p.id
                 where pc.category_id = ${sql.raw('"categories"."id"')} and p.is_active
                 limit 3) x
      )`,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.position)
    .limit(8);

  // A category with nobody in it is an empty shop window — it promises a
  // specialist that does not exist yet.
  const staffed = categoryRows.filter((c) => c.count > 0);
  if (staffed.length === 0) return null;

  return (
    <section className="container-app py-16">
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow">{t('home.categories_eyebrow', 'Fields of work')}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t('home.categories_title', 'A specialist for the work you actually do')}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t('home.categories_subtitle', 'Every field breaks down into specialisms, and every specialism has someone who works in it.')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {staffed.map((category) => (
          <Link
            key={category.id}
            href={`/personas?category=${category.slug}`}
            className="focus-ring surface group flex min-w-0 flex-col p-5 transition hover:border-brand-400/40"
          >
            <PersonaMark
              personaKey={category.slug}
              categoryKey={category.slug}
              categoryIndex={category.id}
              accent={category.color ?? '#6366f1'}
              className="size-11"
            />

            <h3 className="mt-3 font-semibold leading-tight">{category.name}</h3>

            {category.sectorNames.length > 0 ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {category.sectorNames.join(' · ')}
              </p>
            ) : category.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{category.description}</p>
            ) : null}

            <div className="mt-auto pt-4">
              {category.personaNames.length > 0 ? (
                <p className="truncate text-[11px] text-slate-400">
                  {category.personaNames.join(', ')}
                  {category.count > category.personaNames.length ? ` +${category.count - category.personaNames.length}` : ''}
                </p>
              ) : null}
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                {t('home.categories_browse', 'Browse')} {category.count}
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
