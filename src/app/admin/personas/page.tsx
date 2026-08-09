import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { and, asc, desc, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { ListPagination } from '@/components/admin/list-pagination';
import { getProviderRegistry, resolveProviderId } from '@/lib/ai/registry';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { parseListParams, type ListConfig } from '@/lib/admin/list-query';
import { formatCredits, initialsOf } from '@/lib/utils';
import { PersonasList, type PersonaRow } from './personas-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Personas' };

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rawParams, categoryRows, registry, view] = await Promise.all([
    searchParams,
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position)),
    getProviderRegistry(),
    getAdminView('personas'),
  ]);

  // Provider options come from the registry rather than a hardcoded list, so a
  // provider added later appears in the filter without another edit here.
  const config: ListConfig = {
    filters: [
      { key: 'category', label: 'Category', options: categoryRows.map((c) => ({ id: String(c.id), label: c.name })) },
      {
        key: 'status',
        label: 'Status',
        options: [
          { id: 'published', label: 'Published' },
          { id: 'draft', label: 'Draft' },
          { id: 'featured', label: 'Featured' },
          { id: 'premium', label: 'Premium' },
        ],
      },
      {
        key: 'provider',
        label: 'Provider',
        options: Object.entries(registry).map(([id, provider]) => ({ id, label: provider.label })),
      },
      {
        key: 'audience',
        label: 'Audience',
        options: [
          { id: 'B2C', label: 'Consumer (B2C)' },
          { id: 'B2B', label: 'Business (B2B)' },
          { id: 'B2G', label: 'Government (B2G)' },
        ],
      },
    ],
    sorts: [
      { id: 'position', label: 'Sort: manual order' },
      { id: 'name', label: 'Sort: name A–Z' },
      { id: 'newest', label: 'Sort: newest first' },
      { id: 'popular', label: 'Sort: most used' },
    ],
    defaultSort: 'position',
  };

  const params = parseListParams(rawParams, config);

  // Filtering happens in SQL, not in JavaScript over a full table read — this
  // has to stay correct at 5,000 personas, not just at 150.
  const conditions = [];

  if (params.q) {
    const term = `%${params.q}%`;
    conditions.push(
      or(
        ilike(personas.name, term),
        ilike(personas.tagline, term),
        ilike(personas.expertise, term),
        ilike(personas.slug, term),
      ),
    );
  }

  const status = params.filters.status;
  if (status === 'published') conditions.push(eq(personas.isActive, true));
  if (status === 'draft') conditions.push(eq(personas.isActive, false));
  if (status === 'featured') conditions.push(eq(personas.isFeatured, true));
  if (status === 'premium') conditions.push(eq(personas.isPremium, true));

  if (params.filters.provider) conditions.push(eq(personas.aiProvider, params.filters.provider));
  if (params.filters.audience) conditions.push(sql`${personas.audienceType}::text = ${params.filters.audience}`);

  if (params.filters.category) {
    // EXISTS rather than a join: a persona in three categories must appear
    // once, and a join would return it three times, breaking both the count
    // and the page size.
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(personaCategories)
          .where(
            and(
              eq(personaCategories.personaId, personas.id),
              eq(personaCategories.categoryId, Number(params.filters.category)),
            ),
          ),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    {
      position: [asc(personas.position), asc(personas.name)],
      name: [asc(personas.name)],
      newest: [desc(personas.createdAt)],
      popular: [desc(personas.messagesCount)],
    }[params.sort] ?? [asc(personas.position)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        persona: personas,
        modelTier: personaVersions.modelTier,
        model: personaVersions.model,
        aiProvider: personaVersions.aiProvider,
      })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(where)
      .orderBy(...orderBy)
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage),
    // Counted with the same conditions, so "312 results" always matches what
    // paging all the way through would actually give you.
    db.select({ total: sql<number>`count(*)::int` }).from(personas).where(where),
  ]);

  const items: PersonaRow[] = rows.map(({ persona, modelTier, model, aiProvider }) => ({
    id: persona.id,
    name: persona.name,
    expertise: persona.expertise,
    accentColor: persona.accentColor,
    initials: initialsOf(persona.name),
    model: modelTier
      ? modelTier.charAt(0).toUpperCase() + modelTier.slice(1)
      : (model ?? registry[resolveProviderId(aiProvider)].defaultModel),
    messages: formatCredits(persona.messagesCount),
    isActive: persona.isActive,
    isFeatured: persona.isFeatured,
  }));

  return (
    <div>
      <PageHeader
        title="Personas"
        description="Every AI specialist available on the platform."
        actions={
          <Link
            href="/admin/personas/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> New persona
          </Link>
        }
      />

      <ListToolbar params={params} config={config} total={total} />

      <PersonasList rows={items} view={view} />

      <ListPagination pathname="/admin/personas" params={params} config={config} total={total} />
    </div>
  );
}
