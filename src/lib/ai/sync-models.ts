import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiModels, type AiProviderRow } from '@/db/schema';
import { fetchProviderModels, type FetchedModel } from './fetch-models';

/**
 * "Fetch models" — bring the catalogue up to date with what the provider
 * offers right now, with nothing to tick.
 *
 * It used to be a checkbox grid: fetch, pick, import. That made sense when a
 * provider listed a dozen models, and none at all once OpenRouter listed
 * three hundred. Now every model the catalogue does not know yet is added, and
 * the safety comes from *how* it is added rather than from a person choosing:
 *
 * - **New models arrive as `preview`.** The registry only ever offers
 *   `stable` rows (src/lib/ai/registry.ts), so nothing here reaches a customer
 *   until an admin marks it Stable and gives it a price.
 * - **Existing rows are never touched** — not their label, tier, price or
 *   status. Those are decisions someone made.
 * - **Models the provider no longer lists are only reported.** Provider lists
 *   use dated ids (`claude-sonnet-4-5-20250929`) while the catalogue often
 *   stores the alias a persona points at (`claude-sonnet-4-5`), so "absent from
 *   the list" is not the same as "gone". Retiring them automatically would
 *   switch off models live bots are using.
 */

/** What an unvetted model is added with — no tier, not offered, a placeholder price to be set before it goes Stable. */
export const PREVIEW_DEFAULTS = { tier: null, status: 'preview' as const, creditsPer1k: 5 };

export type SyncResult =
  | { ok: true; added: FetchedModel[]; notListed: string[]; listed: number }
  | { ok: false; error: string };

/** Large enough for OpenRouter's whole list in one go, small enough to stay well under Postgres' parameter limit. */
const INSERT_CHUNK = 500;

export async function syncProviderModels(provider: AiProviderRow): Promise<SyncResult> {
  const result = await fetchProviderModels(provider);
  if ('error' in result) return { ok: false, error: result.error };

  const existing = await db
    .select({ modelId: aiModels.modelId, status: aiModels.status })
    .from(aiModels)
    .where(eq(aiModels.providerId, provider.id));

  const known = new Set(existing.map((row) => row.modelId));
  const listed = new Set(result.models.map((model) => model.id));

  // A provider listing the same id twice would otherwise be one insert that
  // conflicts with itself.
  const added = [...new Map(result.models.filter((m) => !known.has(m.id)).map((m) => [m.id, m])).values()];

  for (let start = 0; start < added.length; start += INSERT_CHUNK) {
    await db
      .insert(aiModels)
      .values(
        added.slice(start, start + INSERT_CHUNK).map((model) => ({
          providerId: provider.id,
          modelId: model.id,
          label: model.label,
          modality: model.modality,
          ...PREVIEW_DEFAULTS,
        })),
      )
      .onConflictDoNothing();
  }

  // Retired rows are expected to be missing — counting them would make the
  // number grow forever and mean nothing.
  const notListed = existing
    .filter((row) => row.status !== 'retired' && !listed.has(row.modelId))
    .map((row) => row.modelId);

  return { ok: true, added, notListed, listed: result.models.length };
}

/** One line an owner can read: what changed, and what deserves a look. */
export function describeSync(result: Extract<SyncResult, { ok: true }>): string {
  if (result.listed === 0) return 'The provider listed no models.';

  const parts = [
    result.added.length > 0
      ? `+${result.added.length} new (preview, not offered yet)`
      : `No new models — all ${result.listed} are already in the catalogue`,
  ];
  if (result.notListed.length > 0) parts.push(`${result.notListed.length} not in the provider's list`);
  return parts.join(' · ');
}
