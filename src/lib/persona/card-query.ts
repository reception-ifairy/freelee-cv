import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { personas, personaVersions, sectors } from '@/db/schema';
import type { PersonaCardData } from '@/components/site/persona-card';

/**
 * The shape every persona card needs, fetched the same way everywhere.
 *
 * Three surfaces each built their own `select` and handed the card a whole
 * `personas` row — a 47-column type it used six fields of. One projection means
 * a card cannot be given subtly different data on different pages.
 *
 * Most of what the card shows lives on **`persona_versions`** via
 * `currentVersionId`, not on `personas`: tools, capabilities, guardrails,
 * knowledge domains and the model tier all moved there in the versioning work.
 * A query that forgets that join renders a card with nothing on its back.
 *
 * The category comes from a **correlated subquery, not a join**.
 * `persona_categories` is many-to-many, so joining it multiplies rows and every
 * count downstream comes back wrong — the exact failure that made /admin/packs
 * 500 and /admin/customers report zero chats for everyone. A subquery takes one
 * category and leaves the row count alone.
 *
 * Every reference to the outer table is explicitly qualified. Drizzle emits a
 * bare `"id"` inside a `sql` template, which Postgres then resolves against the
 * *inner* table — silently comparing each persona to its own id.
 */
const CATEGORY = (column: string) => sql<string | null>`(
  select c.${sql.raw(column)}
    from persona_categories pc
    join categories c on c.id = pc.category_id
   where pc.persona_id = ${sql.raw('"personas"."id"')}
   order by c.position
   limit 1
)`;

/** Spread into any persona `.select()`. Requires the two leftJoins below. */
export const personaCardColumns = {
  slug: personas.slug,
  name: personas.name,
  tagline: personas.tagline,
  expertise: personas.expertise,
  accentColor: personas.accentColor,
  isPremium: personas.isPremium,
  creditsPerMessage: personas.creditsPerMessage,
  messagesCount: personas.messagesCount,

  audienceType: personaVersions.audienceType,
  modelTier: personaVersions.modelTier,
  knowledgeDomains: personaVersions.knowledgeDomains,
  tools: personaVersions.tools,
  capabilities: personaVersions.capabilities,
  guardrails: personaVersions.guardrails,

  sectorName: sectors.name,
  sectorSlug: sectors.slug,

  categoryId: sql<number | null>`(
    select c.id
      from persona_categories pc
      join categories c on c.id = pc.category_id
     where pc.persona_id = ${sql.raw('"personas"."id"')}
     order by c.position
     limit 1
  )`,
  categoryName: CATEGORY('name'),
  categorySlug: CATEGORY('slug'),
  categoryColor: CATEGORY('color'),
} as const;

/** The two joins `personaCardColumns` depends on. Applied by every surface, in this order. */
export const personaCardJoins = {
  version: [personaVersions, eq(personaVersions.id, personas.currentVersionId)] as const,
  sector: [sectors, eq(sectors.id, personas.sectorId)] as const,
};

type Row = {
  [K in keyof typeof personaCardColumns]: unknown;
};

/** Normalises a joined row into what the card takes. Nulls become empty arrays — a persona with no tools is normal, not missing. */
export function toCardData(row: Row): PersonaCardData {
  return {
    slug: String(row.slug),
    name: String(row.name),
    tagline: (row.tagline as string | null) ?? null,
    expertise: (row.expertise as string | null) ?? null,
    accentColor: String(row.accentColor),
    isPremium: Boolean(row.isPremium),
    audienceType: (row.audienceType as string | null) ?? null,
    messagesCount: Number(row.messagesCount ?? 0),
    creditsPerMessage: Number(row.creditsPerMessage ?? 0),
    categoryName: (row.categoryName as string | null) ?? null,
    categorySlug: (row.categorySlug as string | null) ?? null,
    categoryColor: (row.categoryColor as string | null) ?? null,
    categoryId: (row.categoryId as number | null) ?? null,
    sectorName: (row.sectorName as string | null) ?? null,
    sectorSlug: (row.sectorSlug as string | null) ?? null,
    knowledgeDomains: (row.knowledgeDomains as string[] | null) ?? [],
    tools: (row.tools as string[] | null) ?? [],
    capabilities: (row.capabilities as Record<string, boolean | undefined> | null) ?? {},
    guardrailCount: ((row.guardrails as string[] | null) ?? []).length,
    modelTier: (row.modelTier as string | null) ?? null,
  };
}
