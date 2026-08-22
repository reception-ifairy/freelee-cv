import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, Layers, Plus, Tags } from 'lucide-react';
import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MeterGroup } from '@/components/ui/meter';
import { PersonaMark } from '@/components/site/persona-mark';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Taxonomy' };

/**
 * Categories and their sectors, on one screen.
 *
 * They were two top-level nav items, and the second was useless on its own:
 * `sectors` was **write-only** — 103 curated rows read by nothing outside its
 * own admin screen, because no persona had ever pointed at one. A separate tab
 * for a table nothing consumed was a tab that could only ever be filled in.
 *
 * Now that a persona has a sector, the two belong together: a sector is only
 * meaningful *inside* its category, and seeing the tree is the whole job.
 */
export default async function AdminTaxonomyPage() {
  const [categoryRows, sectorRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        color: categories.color,
        isActive: categories.isActive,
        // Explicitly qualified — a bare "id" inside a correlated subquery binds
        // to the inner table, which is how three earlier admin screens ended up
        // silently counting zero.
        personaCount: sql<number>`(select count(*)::int from persona_categories pc where pc.category_id = ${sql.raw('"categories"."id"')})`,
        directCount: sql<number>`(select count(*)::int from personas p join sectors s on s.id = p.sector_id where s.category_id = ${sql.raw('"categories"."id"')})`,
      })
      .from(categories)
      .orderBy(asc(categories.position)),
    db
      .select({
        id: sectors.id,
        categoryId: sectors.categoryId,
        name: sectors.name,
        slug: sectors.slug,
        code: sectors.code,
        isActive: sectors.isActive,
        b2c: sectors.b2cSuitability,
        b2b: sectors.b2bSuitability,
        b2g: sectors.b2gSuitability,
        personaCount: sql<number>`(select count(*)::int from personas p where p.sector_id = ${sql.raw('"sectors"."id"')})`,
      })
      .from(sectors)
      .orderBy(asc(sectors.position), asc(sectors.name)),
  ]);

  return (
    <div>
      <PageHeader
        title="Taxonomy"
        description="Twenty fields, each carrying its market, its regulation, its risk level and the people it serves — the brief a specialist gets designed against. Open one to design a bot for it."
        actions={
          <Link
            href="/admin/categories/new"
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-on-brand hover:bg-brand-700"
          >
            <Plus className="size-4" /> New category
          </Link>
        }
      />

      {categoryRows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="A category groups specialists by field, and drives which chat layout and tools a persona gets. Sectors live inside one."
          action={{ label: 'New category', href: '/admin/categories/new' }}
        />
      ) : (
        <div className="space-y-4">
          {categoryRows.map((category) => {
            const own = sectorRows.filter((s) => s.categoryId === category.id);
            const accent = category.color ?? '#6366f1';

            return (
              <Card key={category.id} padding="md">
                <div className="flex items-start gap-4">
                  {/* The same generated mark the persona cards use, seeded from
                      the category alone — so a category and its specialists are
                      visibly the same family. */}
                  <PersonaMark
                    personaKey={category.slug}
                    categoryKey={category.slug}
                    categoryIndex={category.id}
                    accent={accent}
                    className="size-12"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">
                        <Link href={`/admin/taxonomy/${category.id}`} className="hover:underline">
                          {category.name}
                        </Link>
                      </h2>
                      {!category.isActive ? <Badge tone="slate">Hidden</Badge> : null}
                      <Badge tone="slate">{own.length} sector{own.length === 1 ? '' : 's'}</Badge>
                      <Badge tone={category.personaCount > 0 ? 'brand' : 'slate'}>
                        {category.personaCount} persona{category.personaCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    {category.description ? (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{category.description}</p>
                    ) : null}
                    {/* The slug is shown because it is a contract, not a
                        cosmetic: chat-layout selection and tool suggestions key
                        off it, and it deliberately no longer changes when the
                        category is renamed. */}
                    <p className="mt-1 font-mono text-[11px] text-slate-500">/{category.slug}</p>
                  </div>

                  {/* Open, not Edit. The field's data is the smaller half of
                      what lives behind this link now — the brief, its audiences
                      and the design workbench are the other half. */}
                  <Link
                    href={`/admin/taxonomy/${category.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold"
                  >
                    <FlaskConical className="size-3.5" /> Open
                  </Link>
                </div>

                {own.length > 0 ? (
                  <div className="mt-4 grid gap-2 border-t hairline pt-4 sm:grid-cols-2 xl:grid-cols-3">
                    {own.map((sector) => (
                      <Link
                        key={sector.id}
                        href={`/admin/sectors/${sector.id}`}
                        className="focus-ring group rounded-control border hairline p-3 transition hover:border-brand-400/40 hover:bg-white/[0.03]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{sector.name}</span>
                          {sector.personaCount > 0 ? (
                            <Badge tone="brand">{sector.personaCount}</Badge>
                          ) : null}
                          {!sector.isActive ? <Badge tone="slate">off</Badge> : null}
                        </div>
                        {/* Suitability was curated data that nothing read. Now
                            that a persona has a sector it can finally mean
                            something, so it is shown where it is decided. */}
                        <MeterGroup
                          className="mt-2"
                          items={[
                            { label: 'B2C', value: sector.b2c },
                            { label: 'B2B', value: sector.b2b, tone: 'emerald' },
                            { label: 'B2G', value: sector.b2g, tone: 'amber' },
                          ]}
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 flex items-center gap-2 border-t hairline pt-4 text-xs text-slate-500">
                    <Layers className="size-3.5" />
                    No sectors yet —{' '}
                    <Link href="/admin/sectors/new" className="font-semibold text-brand-500 hover:underline">add one</Link>
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
