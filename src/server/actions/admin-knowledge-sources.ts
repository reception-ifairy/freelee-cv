'use server';

// Named admin-knowledge-sources.ts, not admin/knowledge-sources.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { knowledgeSources } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { searchMany } from '@/lib/knowledge/registry';
import type { ActionState } from './auth';

const newSourceSchema = z.object({
  label: z.string().trim().min(2).max(120),
  baseUrl: z.string().trim().url(),
  path: z.string().trim().min(1).default('/v1/search'),
  apiKey: z.string().trim().max(500).optional(),
  grant: z.string().trim().max(200).optional(),
  resultsPath: z.string().trim().min(1).default('data.results'),
  titlePath: z.string().trim().min(1).default('title'),
  textPath: z.string().trim().min(1).default('text'),
  citationPath: z.string().trim().min(1).default('sourceUrl'),
});

export async function createKnowledgeSourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = newSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const data = parsed.data;

  const key = slugify(data.label) || 'source';
  try {
    await db.insert(knowledgeSources).values({ ...data, key, apiKey: data.apiKey || null, grant: data.grant || null });
  } catch {
    return { error: `"${key}" already exists — pick a different label.` };
  }

  revalidatePath('/admin/knowledge-sources');
  return { success: `Added "${data.label}".` };
}

const updateSourceSchema = z.object({
  id: z.coerce.number().int(),
  label: z.string().trim().min(2).max(120),
  baseUrl: z.string().trim().url(),
  path: z.string().trim().min(1),
  apiKey: z.string().trim().max(500).optional(),
  grant: z.string().trim().max(200).optional(),
  resultsPath: z.string().trim().min(1),
  titlePath: z.string().trim().min(1),
  textPath: z.string().trim().min(1),
  citationPath: z.string().trim().min(1),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function updateKnowledgeSourceAction(formData: FormData) {
  await requireAdmin();
  const parsed = updateSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { id, apiKey, grant, ...rest } = parsed.data;

  // Blank apiKey/grant on an edit means "leave unchanged" — same convention
  // as the settings form's secret fields (src/components/admin/settings-form.tsx),
  // not "clear it". Use the dedicated clear checkbox below to actually remove one.
  const values: Partial<typeof knowledgeSources.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (apiKey) values.apiKey = apiKey;
  if (grant) values.grant = grant;
  if (formData.get('clearApiKey') === 'on') values.apiKey = null;
  if (formData.get('clearGrant') === 'on') values.grant = null;

  await db.update(knowledgeSources).set(values).where(eq(knowledgeSources.id, id));
  revalidatePath('/admin/knowledge-sources');
}

export async function deleteKnowledgeSourceAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));
  revalidatePath('/admin/knowledge-sources');
}

const testSourceSchema = z.object({ key: z.string().min(1), query: z.string().trim().min(1).max(200) });

/** "Test connection" — fires a real search through the exact same code path a chat turn uses, so the admin gets immediate feedback the dot-paths are right without creating a persona first. */
export async function testKnowledgeSourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = testSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a test query.' };

  const chunks = await searchMany([parsed.data.key], parsed.data.query, 3);
  if (chunks.length === 0) {
    return { error: 'No results — check the base URL/path/API key, and that resultsPath points at the hits array.' };
  }

  return { success: `${chunks.length} result(s). First: "${chunks[0].title}" — ${chunks[0].text.slice(0, 100)}…` };
}
