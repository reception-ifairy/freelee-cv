'use server';

// Named admin-translations.ts, not admin/translations.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-billing.ts.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { readFile } from 'node:fs/promises';
import { generateText } from 'ai';
import { db } from '@/db';
import { locales, translations, settings } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getProviderRegistry, getModel, resolveProviderId } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';
import type { ActionState } from './auth';

/**
 * The panel only adds frontend-namespace locales this phase — the admin
 * panel itself has no wired-up t() call sites yet (docs/17-translations.md),
 * so there's nothing for an admin-namespace translation to actually change.
 */
const NAMESPACE = 'frontend';
const BANK_PATH = 'i18n/frontend.en.json';

async function getChatModel() {
  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(await getSettingString('ai_default_provider', 'openai'));
  const modelId = registry[providerId].defaultModel;
  const apiKey = (await getSettingString(`${providerId}_api_key`)) || undefined;
  return getModel(registry, providerId, modelId, { apiKey });
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
}

/**
 * Reads the current word bank, asks the AI to translate it, upserts every
 * row it gets back, and flips the locale to `active` on success — the
 * "unfreeze" the admin panel promises once a translation completes. Shared
 * by both the "add a new language" flow and the "retry a pending one" flow.
 * Never throws outward — a failure leaves the locale `pending` (still
 * frozen) with a message the admin can act on, rather than crashing the
 * request.
 */
async function runTranslationPipeline(code: string, name: string): Promise<ActionState> {
  try {
    const bank: Record<string, string> = JSON.parse(await readFile(BANK_PATH, 'utf8'));
    const keys = Object.keys(bank);
    if (keys.length === 0) {
      return { error: `The word bank (${BANK_PATH}) is empty — run npm run i18n:extract first.` };
    }

    const model = await getChatModel();
    const { text } = await generateText({
      model,
      system:
        `You are a professional UI/UX localizer for a modern SaaS product. Translate the JSON ` +
        `object's values from English into ${name} — natural, idiomatic phrasing a native speaker ` +
        `would actually write in a product UI, not a literal word-for-word translation. Keep any ` +
        `{placeholder} tokens (e.g. {count}, {credits}, {year}, {siteName}) exactly as-is, unchanged, ` +
        `repositioned only if the target language's grammar requires it. Preserve the tone: ` +
        `confident, concise, modern. Return ONLY a JSON object with the exact same keys and ` +
        `translated string values — no markdown code fences, no commentary, no extra keys, no ` +
        `missing keys.`,
      prompt: JSON.stringify(bank, null, 2),
    });

    const translated: Record<string, string> = JSON.parse(stripCodeFence(text));

    let upserted = 0;
    for (const key of keys) {
      const value = translated[key];
      if (!value) continue;
      await db
        .insert(translations)
        .values({ namespace: NAMESPACE, key, locale: code, value })
        .onConflictDoUpdate({
          target: [translations.namespace, translations.key, translations.locale],
          set: { value, updatedAt: new Date() },
        });
      upserted += 1;
    }

    if (upserted === 0) throw new Error('The AI returned no usable translations.');

    await db.update(locales).set({ status: 'active' }).where(eq(locales.code, code));
    return { success: `"${name}" (${code}) translated — ${upserted}/${keys.length} strings — and activated.` };
  } catch (error) {
    console.error(`[translations] pipeline failed for ${code}`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Translation failed for "${name}" — still pending, retry when ready. (${message})` };
  }
}

const addLocaleSchema = z.object({ languageName: z.string().trim().min(2).max(60) });

/**
 * The "intelligent AI menu" entry point: admin types a plain language name
 * ("German"), the AI resolves the ISO code, the locale is inserted
 * `pending` ("frozen" — not selectable) immediately, then the same request
 * runs the full translation pipeline and unfreezes it on success.
 */
export async function addLocaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = addLocaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a language name.' };
  const { languageName } = parsed.data;

  const model = await getChatModel();
  const { text: codeRaw } = await generateText({
    model,
    system:
      'Reply with ONLY the two-letter ISO 639-1 code (lowercase) for the language the user names — ' +
      'e.g. "de", "fr", "es". No punctuation, no explanation, just the two letters.',
    prompt: languageName,
  });
  const code = codeRaw.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
  if (!/^[a-z]{2}$/.test(code)) {
    return { error: `Couldn't determine a language code for "${languageName}" (model said "${codeRaw.trim()}").` };
  }

  const [existing] = await db.select({ status: locales.status }).from(locales).where(eq(locales.code, code)).limit(1);
  if (existing) return { error: `"${languageName}" (${code}) already exists — status: ${existing.status}.` };

  await db.insert(locales).values({ code, name: languageName, status: 'pending' });
  revalidatePath('/admin/translations');

  const result = await runTranslationPipeline(code, languageName);
  revalidatePath('/admin/translations');
  return result;
}

const retryLocaleSchema = z.object({ code: z.string().min(2).max(10) });

export async function retryLocaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { code } = retryLocaleSchema.parse(Object.fromEntries(formData));
  const [row] = await db.select().from(locales).where(eq(locales.code, code)).limit(1);
  if (!row) return { error: 'Locale not found.' };

  const result = await runTranslationPipeline(row.code, row.name);
  revalidatePath('/admin/translations');
  return result;
}

const setActiveLocaleSchema = z.object({ namespace: z.enum(['frontend', 'admin']), code: z.string().min(2).max(10) });

/** The real language switcher — only ever writes a code the `locales` table has as `active` (English is always eligible). */
export async function setActiveLocaleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { namespace, code } = setActiveLocaleSchema.parse(Object.fromEntries(formData));

  if (code !== 'en') {
    const [row] = await db.select({ status: locales.status }).from(locales).where(eq(locales.code, code)).limit(1);
    if (!row || row.status !== 'active') return; // defensive — the picker UI only ever offers active locales anyway
  }

  const settingKey = namespace === 'frontend' ? 'frontend_locale' : 'admin_locale';
  const label = namespace === 'frontend' ? 'Frontend (landing site) language' : 'Admin panel language';

  await db
    .insert(settings)
    .values({ key: settingKey, group: 'localization', value: code, type: 'string', label })
    .onConflictDoUpdate({ target: settings.key, set: { value: code } });

  revalidatePath('/admin/translations');
  revalidatePath('/', 'layout');
}

/** Accepts scripts/export-translations.ts's own output, or a coworker's hand-edited copy of one. */
export async function importTranslationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to import.' };

  let rows: { namespace: string; key: string; locale: string; value: string }[];
  try {
    rows = JSON.parse(await file.text());
  } catch {
    return { error: 'Not valid JSON.' };
  }
  if (!Array.isArray(rows) || rows.some((r) => !r?.namespace || !r?.key || !r?.locale || typeof r?.value !== 'string')) {
    return { error: 'Malformed file — expected an array of {namespace, key, locale, value} objects.' };
  }
  if (rows.some((r) => r.locale === 'en')) {
    return { error: 'File contains locale="en" rows — English is never stored in translations (see docs/17-translations.md).' };
  }

  for (const row of rows) {
    await db
      .insert(translations)
      .values(row)
      .onConflictDoUpdate({
        target: [translations.namespace, translations.key, translations.locale],
        set: { value: row.value, updatedAt: new Date() },
      });
  }

  // An import is a complete, deliberate action (a coworker's finished,
  // reviewed translation) — any locale it touches that isn't already known
  // goes straight to `active`, not `pending`.
  const touchedLocales = [...new Set(rows.map((r) => r.locale))];
  for (const code of touchedLocales) {
    const [existing] = await db.select({ code: locales.code }).from(locales).where(eq(locales.code, code)).limit(1);
    if (!existing) await db.insert(locales).values({ code, name: code.toUpperCase(), status: 'active' });
  }

  revalidatePath('/admin/translations');
  return { success: `Imported ${rows.length} row(s) across ${touchedLocales.length} locale(s).` };
}
