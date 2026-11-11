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
import { checkRateLimit } from '@/lib/rate-limit';
import { probeKnowledgeSource } from '@/lib/knowledge/registry';
import type { TestState } from '@/lib/connections/types';
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
  // An unticked checkbox submits nothing at all. This was a required enum, so
  // unticking "Active" failed validation and the whole save was silently
  // dropped — the one change the box exists for could never be made.
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** So a failed save names the box to fix, not a property name. */
const FIELD_LABELS: Record<string, string> = {
  label: 'Label', baseUrl: 'Base URL', path: 'Path', apiKey: 'API key', grant: 'Grant',
  resultsPath: 'Results path', titlePath: 'Title path', textPath: 'Text path', citationPath: 'Citation path',
};

export async function updateKnowledgeSourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = updateSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { error: 'Please check the form.' };
    const field = String(issue.path[0] ?? '');
    return { error: `${FIELD_LABELS[field] ?? 'Form'}: ${issue.message}` };
  }
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
  return { success: 'Saved. Press Test to check it works.' };
}

export async function deleteKnowledgeSourceAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));
  revalidatePath('/admin/knowledge-sources');
}

export type SourceTestResult = { state: TestState; message: string; titles: string[] };

/**
 * "Test" — one real search through the exact request a chat turn sends, with
 * the source's own label as the query, so there is nothing to type.
 *
 * Searches this one source directly rather than through `searchMany()`, which
 * only looks at *active* sources: testing an inactive source used to report
 * "No results" for a source that worked perfectly, which is exactly when
 * someone wants to test it — before switching it on.
 */
export async function testKnowledgeSourceAction(id: number): Promise<SourceTestResult> {
  const admin = await requireAdmin();
  const parsedId = z.coerce.number().int().safeParse(id);
  if (!parsedId.success) return { state: 'error', message: 'Unknown source.', titles: [] };

  const gate = checkRateLimit({ name: 'knowledge-source-test', key: admin.id, limit: 20, windowMs: 60 * 1000 });
  if (!gate.ok) return { state: 'error', message: `Too many tests in a minute. Try again in ${gate.retryAfter} seconds.`, titles: [] };

  const [source] = await db.select().from(knowledgeSources).where(eq(knowledgeSources.id, parsedId.data)).limit(1);
  if (!source) return { state: 'error', message: 'This source no longer exists.', titles: [] };

  const probe = await probeKnowledgeSource(source, source.label, 3);
  const inactive = source.isActive ? '' : ' It is not Active yet, so bots do not use it.';

  if (!probe.ok) {
    switch (probe.reason) {
      case 'no-key':
        return { state: 'no-key', message: 'No API key saved for this source — chats skip it until one is.', titles: [] };
      case 'refused':
        return probe.status === 401 || probe.status === 403
          ? { state: 'bad-key', message: 'Key rejected. Check it was copied in full and has not been revoked.', titles: [] }
          : { state: 'error', message: `The source answered with an error (HTTP ${probe.status}). Check the base URL and path.`, titles: [] };
      case 'not-json':
        return {
          state: 'error',
          message: 'Reached the server, but it did not answer with JSON. Check the base URL and path point at the search API itself.',
          titles: [],
        };
      case 'no-list':
        return {
          state: 'error',
          message: `Reached the API, but found no list at the results path "${source.resultsPath}". Check the results path.`,
          titles: [],
        };
      default:
        return { state: 'error', message: 'Could not reach the source within 5 seconds. Check the base URL.', titles: [] };
    }
  }

  if (probe.hits > 0 && probe.chunks.length === 0) {
    return {
      state: 'error',
      message: `Reached the API and got ${probe.hits} hits, but none had text at the text path "${source.textPath}". Check the text path.`,
      titles: [],
    };
  }

  if (probe.chunks.length === 0) {
    return {
      state: 'ok',
      message: `Works — the API answered, but a search for "${source.label}" found nothing. If it should have, check the results path.${inactive}`,
      titles: [],
    };
  }

  return {
    state: 'ok',
    message: `Works — ${probe.chunks.length} ${probe.chunks.length === 1 ? 'result' : 'results'} for "${source.label}".${inactive}`,
    titles: probe.chunks.slice(0, 3).map((chunk) => chunk.title),
  };
}
