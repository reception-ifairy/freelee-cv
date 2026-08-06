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
import type { ActionState } from './auth';

const tierSchema = z.enum(['fast', 'balanced', 'advanced']).or(z.literal('')).transform((v) => (v === '' ? null : v));
const statusSchema = z.enum(['preview', 'stable', 'deprecated', 'retired']);

const newModelSchema = z.object({
  providerId: z.coerce.number().int(),
  modelId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  tier: tierSchema,
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
