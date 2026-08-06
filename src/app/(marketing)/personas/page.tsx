import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions } from '@/db/schema';
import { PersonaCard } from '@/components/site/persona-card';
import { AUDIENCE_TYPES } from '@/lib/persona/prompt';

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
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Persona gallery</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {total} specialist{total === 1 ? '' : 's'} across {categoryRows.length} categories. Filter by topic
            or topic to find the right one.
          </p>

          <form method="GET" className="mt-8 flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search by name, topic or expertise…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <select
              name="category"
              defaultValue={params.category ?? ''}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {categoryRows.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name} ({category.count})
                </option>
              ))}
            </select>

            <select
              name="audience"
              defaultValue={params.audience ?? ''}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              aria-label="Audience"
            >
              <option value="">All audiences</option>
              {Object.entries(AUDIENCE_TYPES).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Filter
            </button>

            {params.q || params.category || params.audience ? (
              <Link
                href="/personas"
                className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
      </section>

      <section className="container-app py-12">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
            <Search className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold">No personas match those filters</h2>
            <p className="mt-2 text-sm text-slate-500">Try a broader search or clear the filters.</p>
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
