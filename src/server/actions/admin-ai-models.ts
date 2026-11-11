'use server';

// Named admin-ai-models.ts, not admin/ai-models.ts, because src/server/actions/admin.ts
// already exists as a file — same collision this project already worked around for
// src/lib/permissions.ts (vs. auth.ts). Splitting admin.ts into a real directory is a
// bigger refactor (every `from '@/server/actions/admin'` import site) than this phase
// warrants; this is the first domain-specific admin actions file, as the plan intended,
// just not nested.

import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { aiModels, aiProviders } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { upsertSetting } from '@/lib/settings';
import { CHAT_PROVIDER_IDS } from '@/lib/ai/provider-ids';
import type { ActionState } from './auth';

// The model catalogue now lives in Settings → Models. `/admin/ai-models` is
// only a redirect, so revalidating it refreshed nothing anyone was looking at.
const SETTINGS_PATH = '/admin/settings';

const tierSchema = z.enum(['fast', 'balanced', 'advanced']).or(z.literal('')).transform((v) => (v === '' ? null : v));
const statusSchema = z.enum(['preview', 'stable', 'deprecated', 'retired']);
// 'embedding' joined the enum for the Knowledgebase (drizzle/0035, docs/48).
// Without it here, adding an embedding model by hand would be rejected by
// validation.
const modalitySchema = z.enum(['text', 'image', 'embedding']);

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

  revalidatePath(SETTINGS_PATH);
  return { success: `Added ${parsed.data.modelId}.` };
}

/*
 * Fetching a provider's live model list and the "Test connection" check used
 * to live here as three actions behind a checkbox grid. They moved to the
 * connection cards in Settings → Providers & keys
 * (src/server/actions/admin-connections.ts), where Fetch adds every new model
 * as `preview` without ticking — see src/lib/ai/sync-models.ts.
 */

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

  revalidatePath(SETTINGS_PATH);
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

  revalidatePath(SETTINGS_PATH);
}

const embeddingModelSchema = z.object({ modelId: z.string().trim().max(200) });

/**
 * Picks the model the Knowledgebase embeds with (`library_embedding_model`,
 * read by src/lib/library/embed.ts). The Knowledgebase page has long said this
 * is chosen under Settings, but there was no control for it anywhere.
 *
 * Blank means "automatic" — the first Stable embedding model, which is what
 * `findEmbeddingModel()` does without a preference. Anything else must be a
 * Stable embedding row on a provider that can run it, so the setting can never
 * point at a model the embedder would skip.
 */
export async function saveEmbeddingModelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = embeddingModelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Pick a model.' };
  const { modelId } = parsed.data;

  if (modelId) {
    const [row] = await db
      .select({ id: aiModels.id })
      .from(aiModels)
      .innerJoin(aiProviders, eq(aiProviders.id, aiModels.providerId))
      .where(
        and(
          eq(aiModels.modelId, modelId),
          eq(aiModels.modality, 'embedding'),
          eq(aiModels.status, 'stable'),
          inArray(aiProviders.key, CHAT_PROVIDER_IDS),
        ),
      )
      .limit(1);
    if (!row) return { error: 'That is not a Stable embedding model. Mark it Stable first.' };
  }

  await upsertSetting('library_embedding_model', modelId, 'string', 'ai');

  revalidatePath(SETTINGS_PATH);
  revalidatePath('/admin/knowledgebase');
  return {
    success: modelId
      ? `The Knowledgebase now embeds with ${modelId}. Documents made with another model need processing again.`
      : 'The Knowledgebase now uses the first Stable embedding model.',
  };
}
