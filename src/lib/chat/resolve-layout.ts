import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories } from '@/db/schema';
import { suggestLayoutForPersona, isChatLayoutKey } from './layouts';
import type { ChatLayoutKey } from './layouts';

/**
 * Resolves the chat layout for a persona: an explicit
 * `persona_versions.chat_layout` always wins; otherwise the signals the UK
 * taxonomy already carries are used to suggest one
 * (`suggestLayoutForPersona`).
 *
 * The taxonomy fields consulted here — `categories.narrative_potential`,
 * `sectors.narrative_fit`, `sectors.primary_interaction_modes` — were
 * catalogued in Phase 5 (docs/05-uk-taxonomy.md) and explicitly noted as
 * "not wired into live behaviour yet". This is the first thing that reads
 * them, which is why `NARRATOR` and `FAQ` interaction modes suddenly matter.
 */
export async function resolveLayoutForPersona(
  personaId: number | null | undefined,
  explicit: string | null | undefined,
  audienceType?: string | null,
  audienceSegments?: string[],
): Promise<ChatLayoutKey> {
  if (explicit && isChatLayoutKey(explicit)) return explicit;
  if (!personaId) return 'default';

  const rows = await db
    .select({
      slug: categories.slug,
      narrativePotential: categories.narrativePotential,
    })
    .from(personaCategories)
    .innerJoin(categories, eq(categories.id, personaCategories.categoryId))
    .where(eq(personaCategories.personaId, personaId));

  const categorySlugs = rows.map((r) => r.slug);

  // `sectors.primary_interaction_modes` is deliberately NOT read here.
  //
  // It's a per-sector signal, and a persona links to *categories*, not
  // sectors (`persona_categories`). Flattening every sector's modes up to
  // the category produces a set containing almost every mode — a 5-sector
  // category nearly always has one NARRATOR and one FAQ sector — which made
  // the mode rules fire for 20 of 20 categories and mis-assign Education,
  // Legal and Health. Verified against the live taxonomy, not assumed.
  //
  // The rules stay in `suggestLayoutForPersona` because they're correct for
  // a real per-persona mode signal; there just isn't one to give them yet.
  // If personas ever link to sectors directly, pass it in here.
  const narrativeFit = rows.find((r) => r.narrativePotential === 'very_high')?.narrativePotential
    ?? rows[0]?.narrativePotential
    ?? null;

  return suggestLayoutForPersona({ categorySlugs, audienceType, audienceSegments, narrativeFit });
}
