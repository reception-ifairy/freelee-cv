'use server';

// Named admin-ai-models.ts, not admin/ai-models.ts, because src/server/actions/admin.ts
// already exists as a file — same collision this project already worked around for
// src/lib/permissions.ts (vs. auth.ts). Splitting admin.ts into a real directory is a
// bigger refactor (every `from '@/server/actions/admin'` import site) than this phase
// warrants; this is the first domain-specific admin actions file, as the plan intended,
// just not nested.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { aiModels, aiProviders } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { fetchProviderModels, type FetchedModel } from '@/lib/ai/fetch-models';
import type { ActionState } from './auth';

const tierSchema = z.enum(['fast', 'balanced', 'advanced']).or(z.literal('')).transform((v) => (v === '' ? null : v));
const statusSchema = z.enum(['preview', 'stable', 'deprecated', 'retired']);
const modalitySchema = z.enum(['text', 'image']);

const newModelSchema = z.object({
  providerId: z.coerce.number().int(),
  modelId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  tier: tierSchema,
  modality: modalitySchema.default('text'),
  creditsPer1k: z.coerce.number().int().min(0),
});

export async function createAiModelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = newModelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid model.' };

  try {
    await db.insert(aiModels).values(parsed.data);
  } catch {
    return { error: `That model id already exists for this provider.` };
  }

  revalidatePath('/admin/ai-models');
  return { success: `Added ${parsed.data.modelId}.` };
}

/**
 * Live "what does this provider actually have right now" — see
 * src/lib/ai/fetch-models.ts. Returns data (not just a message), so this
 * uses its own local state shape rather than the shared `ActionState`.
 */
export type FetchModelsState =
  | { error?: string; success?: string; providerId?: number; models?: (FetchedModel & { alreadyAdded: boolean })[] }
  | null;

export async function fetchProviderModelsAction(_prev: FetchModelsState, formData: FormData): Promise<FetchModelsState> {
  await requireAdmin();
  const providerId = z.coerce.number().int().parse(formData.get('providerId'));

  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).limit(1);
  if (!provider) return { error: 'Unknown provider.' };

  const result = await fetchProviderModels(provider);
  if ('error' in result) return { error: result.error };

  const existing = new Set(
    (await db.select({ modelId: aiModels.modelId }).from(aiModels).where(eq(aiModels.providerId, providerId))).map(
      (r) => r.modelId,
    ),
  );

  return {
    providerId,
    models: result.models.map((m) => ({ ...m, alreadyAdded: existing.has(m.id) })),
    success: `Found ${result.models.length} model(s).`,
  };
}

const importSchema = z.object({
  providerId: z.coerce.number().int(),
  modelIds: z.array(z.string().min(1)).min(1, 'Select at least one model to import.'),
});

/**
 * Re-fetches from the provider rather than trusting label/modality posted
 * back from the browser — the admin only ever selected *which* ids to
 * import in the checkbox grid, so re-resolving their label/modality from the
 * same live call avoids any risk of a tampered or stale form value.
 */
export async function importFetchedModelsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = importSchema.safeParse({ providerId: formData.get('providerId'), modelIds: formData.getAll('modelId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Nothing to import.' };
  const { providerId, modelIds } = parsed.data;

  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).limit(1);
  if (!provider) return { error: 'Unknown provider.' };

  const result = await fetchProviderModels(provider);
  if ('error' in result) return { error: result.error };

  const wanted = new Set(modelIds);
  const rows = result.models
    .filter((m) => wanted.has(m.id))
    .map((m) => ({
      providerId,
      modelId: m.id,
      label: m.label,
      modality: m.modality,
      tier: null,
      // Freshly fetched, not yet priced/vetted by an admin — 'preview' is a
      // meaningful use of the existing status enum, not just a default.
      status: 'preview' as const,
      creditsPer1k: 5,
    }));

  if (rows.length === 0) return { error: 'None of the selected models were found — try fetching again.' };

  await db.insert(aiModels).values(rows).onConflictDoNothing();

  revalidatePath('/admin/ai-models');
  return { success: `Imported ${rows.length} model(s) as preview — set pricing/tier below.` };
}

const updateModelSchema = z.object({
  id: z.coerce.number().int(),
  tier: tierSchema,
  status: statusSchema,
  creditsPer1k: z.coerce.number().int().min(0),
  sort: z.coerce.number().int(),
});

export async function updateAiModelAction(formData: FormData) {
  await requireAdmin();
  const parsed = updateModelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { id, ...values } = parsed.data;
  await db.update(aiModels).set({ ...values, updatedAt: new Date() }).where(eq(aiModels.id, id));

  revalidatePath('/admin/ai-models');
}

const updateProviderSchema = z.object({
  id: z.coerce.number().int(),
  defaultModel: z.string().trim().min(1),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function updateAiProviderAction(formData: FormData) {
  await requireAdmin();
  const parsed = updateProviderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { id, ...values } = parsed.data;
  await db.update(aiProviders).set(values).where(eq(aiProviders.id, id));

  revalidatePath('/admin/ai-models');
}
