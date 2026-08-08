import type { Metadata } from 'next';
import Link from 'next/link';
import { Filter, Search, Tags, Users } from 'lucide-react';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions } from '@/db/schema';
import { PersonaCard } from '@/components/site/persona-card';
import { AUDIENCE_TYPES } from '@/lib/persona/prompt';
import { getFrontendT } from '@/lib/i18n/translate';
import { helpTopics } from '@/lib/help/topics';
import { HelpTip } from '@/components/ui/help-tip';

export const metadata: Metadata = {
  title: 'Browse AI personas',
  description: 'Explore every AI specialist on the platform, filtered by topic and teaching level.',
};

const PER_PAGE = 24;

type SearchParams = Promise<{ q?: string; category?: string; audience?: string; page?: string }>;

export default async function PersonasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const term = params.q?.trim();
  const { t } = await getFrontendT();
  const help = helpTopics(t);

  const filters = [eq(personas.isActive, true)];

  if (term) {
    const pattern = `%${term}%`;
    const match = or(
      ilike(personas.name, pattern),
      ilike(personas.tagline, pattern),
      ilike(personas.expertise, pattern),
      ilike(personas.description, pattern),
    );
    if (match) filters.push(match);
  }

  if (params.audience && params.audience in AUDIENCE_TYPES) {
    // audienceType lives on persona_versions since Phase 4 — see docs/11-persona-versioning.md.
    filters.push(eq(personaVersions.audienceType, params.audience as keyof typeof AUDIENCE_TYPES));
  }

  if (params.category) {
    filters.push(
      sql`exists (
        select 1 from ${personaCategories}
        join ${categories} on ${categories.id} = ${personaCategories.categoryId}
        where ${personaCategories.personaId} = ${personas.id}
          and ${categories.slug} = ${params.category}
      )`,
    );
  }

  const where = and(...filters);

  const [rawRows, countRows, categoryRows] = await Promise.all([
    db
      .select({ persona: personas, audienceType: personaVersions.audienceType })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(where)
      .orderBy(asc(personas.position), asc(personas.name))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(where),
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        count: sql<number>`count(${personaCategories.personaId})::int`,
      })
      .from(categories)
      .leftJoin(personaCategories, eq(personaCategories.categoryId, categories.id))
      .where(eq(categories.isActive, true))
      .groupBy(categories.id)
      .orderBy(categories.position),
  ]);

  const rows = rawRows.map((r) => ({ ...r.persona, audienceType: r.audienceType }));
  const total = countRows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="aurora absolute inset-0 -z-10 opacity-70" />
        <div className="container-app py-14">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('personas.title', 'Persona gallery')}</h1>
            <HelpTip title={help['personas.browse'].title} body={help['personas.browse'].body} />
          </div>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {t('personas.subtitle', '{count} specialists across {categories} categories. Filter by topic or audience to find the right one.', {
              count: total,
              categories: categoryRows.length,
            })}
          </p>

          <form method="GET" className="mt-8 flex flex-wrap items-end gap-3">
            <div className="relative min-w-64 flex-1">
              <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('personas.filter_search', 'Search')}
              </label>
              <Search className="pointer-events-none absolute bottom-3 left-3.5 size-4 text-slate-400" />
              <input
                id="q"
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder={t('personas.search_placeholder', 'Search by name, topic or expertise…')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Tags className="size-3.5" />
                {t('personas.filter_category', 'Category')}
              </label>
              <select
                id="category"
                name="category"
                defaultValue={params.category ?? ''}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('personas.filter_all_categories', 'All categories')}</option>
                {categoryRows.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="audience" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Users className="size-3.5" />
                {t('personas.filter_audience', 'Audience')}
                <HelpTip title={help['personas.audience'].title} body={help['personas.audience'].body} />
              </label>
              <select
                id="audience"
                name="audience"
                defaultValue={params.audience ?? ''}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('personas.filter_all_audiences', 'All audiences')}</option>
                {Object.entries(AUDIENCE_TYPES).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Filter className="size-4" />
              {t('personas.filter_apply', 'Filter')}
            </button>

            {params.q || params.category || params.audience ? (
              <Link
                href="/personas"
                className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t('personas.filter_clear', 'Clear')}
              </Link>
            ) : null}
          </form>
        </div>
      </section>

      <section className="container-app py-12">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
            <Search className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold">{t('personas.empty_title', 'No personas match those filters')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('personas.empty_body', 'Try a broader search or clear the filters.')}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} />
              ))}
            </div>

            {pages > 1 ? (
              <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
                  const query = new URLSearchParams();
                  if (params.q) query.set('q', params.q);
                  if (params.category) query.set('category', params.category);
                  if (params.audience) query.set('audience', params.audience);
                  query.set('page', String(n));

                  return (
                    <Link
                      key={n}
                      href={`/personas?${query.toString()}`}
                      className={
                        n === page
                          ? 'grid size-10 place-items-center rounded-lg bg-brand-600 text-sm font-semibold text-white'
                          : 'grid size-10 place-items-center rounded-lg border border-slate-200 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }
                    >
                      {n}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
