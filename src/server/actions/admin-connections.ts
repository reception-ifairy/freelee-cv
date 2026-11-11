'use server';

// Named admin-connections.ts, not admin/connections.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSettings, upsertSetting } from '@/lib/settings';
import {
  connectionIdSchema,
  forgetTest,
  getConnection,
  readStoredTest,
  rememberTest,
  runTest,
  settingsGroupFor,
} from '@/lib/connections/registry';
import type { FetchResult, StoredTest } from '@/lib/connections/types';
import type { ActionState } from './auth';

/**
 * The three buttons on every connection card — Save, Test, Fetch — plus the
 * pick that follows a fetch (ElevenLabs' voice).
 *
 * Each takes the connection id as its first argument and is handed to the
 * card pre-bound (`saveConnectionAction.bind(null, 'openai')`), so the card
 * stays generic. A bound argument still arrives from the browser, so the id is
 * validated here like any other input.
 */

const fieldValueSchema = z.string().trim().max(500, 'That value is too long — paste only the key itself.');
const urlSchema = z.url('Enter a full address, e.g. http://localhost:11434/v1');

/**
 * Saves only this connection's own fields, never anything else posted with
 * them — unlike the generic settings form, which writes whatever `key:type`
 * names arrive. A blank secret keeps the stored one, same rule as everywhere.
 */
export async function saveConnectionAction(id: string, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsedId = connectionIdSchema.safeParse(id);
  if (!parsedId.success) return { error: 'Unknown connection.' };

  const connection = getConnection(parsedId.data);
  if (connection.envOnly) return { error: "This one is set in the server's env file, not here." };

  const writes: { key: string; value: string; type: 'secret' | 'string' }[] = [];
  for (const field of connection.fields) {
    const raw = formData.get(field.key);
    if (typeof raw !== 'string') continue;

    const parsed = fieldValueSchema.safeParse(raw);
    if (!parsed.success) return { error: `${field.label}: ${parsed.error.issues[0]?.message ?? 'invalid value.'}` };
    const value = parsed.data;

    if (field.type === 'secret' && value === '') continue;
    if (field.format === 'url' && value !== '') {
      const url = urlSchema.safeParse(value);
      if (!url.success) return { error: `${field.label}: ${url.error.issues[0]?.message ?? 'not a valid address.'}` };
    }
    writes.push({ key: field.key, value, type: field.type });
  }

  if (writes.length === 0) return { error: 'Nothing to save. Paste a key first — a blank box keeps the one already saved.' };

  for (const write of writes) {
    await upsertSetting(write.key, write.value, write.type, settingsGroupFor(write.key));
  }
  await forgetTest(connection.id);

  revalidatePath('/admin/settings');
  return { success: 'Saved. Press Test to check it works.' };
}

/**
 * Asks the service whether it actually works, and remembers the answer.
 *
 * Rate-limited because for the AI providers it is a real (tiny) paid request,
 * and an admin clicking repeatedly should not become a way to spend money.
 */
export async function testConnectionAction(id: string): Promise<StoredTest> {
  const admin = await requireAdmin();
  const parsedId = connectionIdSchema.safeParse(id);
  if (!parsedId.success) return { state: 'error', message: 'Unknown connection.', at: new Date().toISOString() };

  const gate = checkRateLimit({ name: 'connection-test', key: admin.id, limit: 20, windowMs: 60 * 1000 });
  if (!gate.ok) {
    // Not remembered: being throttled says nothing about the connection.
    return {
      state: 'error',
      message: `Too many tests in a minute. Try again in ${gate.retryAfter} seconds.`,
      at: new Date().toISOString(),
    };
  }

  const stored = await rememberTest(parsedId.data, await runTest(parsedId.data));
  revalidatePath('/admin/settings');
  return stored;
}

/**
 * Pulls what the service offers — models, voices, domains.
 *
 * Refuses unless the remembered test passed. The card only shows Fetch after a
 * passing test; holding the server to the same order means a stale page cannot
 * sync a catalogue against a key that has since been replaced.
 */
export async function fetchConnectionAction(id: string): Promise<FetchResult> {
  const admin = await requireAdmin();
  const parsedId = connectionIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, summary: 'Unknown connection.' };

  const connection = getConnection(parsedId.data);
  if (!connection.fetch) return { ok: false, summary: 'There is nothing to fetch for this one.' };

  const gate = checkRateLimit({ name: 'connection-fetch', key: admin.id, limit: 20, windowMs: 60 * 1000 });
  if (!gate.ok) return { ok: false, summary: `Too many fetches in a minute. Try again in ${gate.retryAfter} seconds.` };

  if (readStoredTest(await getSettings(), connection.id)?.state !== 'ok') {
    return { ok: false, summary: 'Run Test first — Fetch opens once the test passes.' };
  }

  let result: FetchResult;
  try {
    result = await connection.fetch();
  } catch {
    result = { ok: false, summary: 'The fetch failed. Try again, and look at the server log if it keeps happening.' };
  }

  revalidatePath('/admin/settings');
  return result;
}

const itemIdSchema = z.string().trim().min(1, 'Pick one first.').max(200);

/** Saves a fetched item as the default — today only ElevenLabs' voice. */
export async function chooseConnectionItemAction(id: string, itemId: string): Promise<ActionState> {
  await requireAdmin();
  const parsedId = connectionIdSchema.safeParse(id);
  if (!parsedId.success) return { error: 'Unknown connection.' };

  const connection = getConnection(parsedId.data);
  if (!connection.choose) return { error: 'There is nothing to choose for this one.' };

  const parsedItem = itemIdSchema.safeParse(itemId);
  if (!parsedItem.success) return { error: parsedItem.error.issues[0]?.message ?? 'Pick one first.' };

  const result = await connection.choose(parsedItem.data);
  revalidatePath('/admin/settings');
  return result;
}
