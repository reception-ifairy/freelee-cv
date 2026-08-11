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
import { getProviderRegistry, getModel, resolveProviderId, resolveProviderKeys } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';
import { ALL_NAMESPACES, NAMESPACE_LABELS, bankPath, isNamespace } from '@/lib/i18n/namespaces';
import type { Namespace } from '@/lib/i18n/namespaces';
import type { ActionState } from './auth';

async function getChatModel() {
  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(await getSettingString('ai_default_provider', 'openai'));
  const modelId = registry[providerId].defaultModel;
  return getModel(registry, providerId, modelId, await resolveProviderKeys(providerId));
}

function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
}

function systemPromptFor(languageName: string, moduleLabel: string): string {
  return (
    `You are a professional UI/UX localizer for a modern SaaS product. You are translating the ` +
    `"${moduleLabel}" section of its interface from English into ${languageName}.\n\n` +
    `Rules:\n` +
    `- Produce natural, idiomatic phrasing a native speaker would actually write in a product UI — ` +
    `not a literal word-for-word translation.\n` +
    `- Keep every {placeholder} token (e.g. {count}, {credits}, {year}, {siteName}, {minutes}, ` +
    `{date}) exactly as-is, spelled identically. Reposition one only if the target language's ` +
    `grammar demands it.\n` +
    `- Preserve the tone: confident, concise, modern. Keep UI labels short — a button label that ` +
    `doubles in length breaks the layout.\n` +
    `- Return ONLY a JSON object with the exact same keys and translated string values. No markdown ` +
    `code fences, no commentary, no extra keys, no missing keys.`
  );
}

/** One module's outcome, so the caller can report per-module rather than one opaque total. */
type ModuleResult = { namespace: Namespace; total: number; translated: number; error?: string };

async function translateModule(
  code: string,
  languageName: string,
  namespace: Namespace,
  model: Awaited<ReturnType<typeof getChatModel>>,
): Promise<ModuleResult> {
  let bank: Record<string, string>;
  try {
    bank = JSON.parse(await readFile(bankPath(namespace), 'utf8'));
  } catch {
    return { namespace, total: 0, translated: 0 }; // module file absent — nothing to do, not an error
  }

  const keys = Object.keys(bank);
  if (keys.length === 0) return { namespace, total: 0, translated: 0 };

  try {
    const { text } = await generateText({
      model,
      system: systemPromptFor(languageName, NAMESPACE_LABELS[namespace]),
      prompt: JSON.stringify(bank, null, 2),
    });
    const translated: Record<string, string> = JSON.parse(stripCodeFence(text));

    let count = 0;
    for (const key of keys) {
      const value = translated[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      await db
        .insert(translations)
        .values({ namespace, key, locale: code, value })
        .onConflictDoUpdate({
          target: [translations.namespace, translations.key, translations.locale],
          set: { value, updatedAt: new Date() },
        });
      count += 1;
    }

    return { namespace, total: keys.length, translated: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[translations] module "${namespace}" failed for ${code}`, error);
    return { namespace, total: keys.length, translated: 0, error: message };
  }
}

/**
 * Translates the word bank **one module at a time** — the reason the bank is
 * split at all. A single request carrying every string in the product drifts,
 * truncates, and silently drops keys as it grows; a per-module request stays
 * small enough to come back complete, and a module that does fail is isolated
 * (the other nine still land, and the admin retries just that one).
 *
 * The locale only flips to `active` ("unfrozen") if **every** module produced
 * at least something — a language that's half-translated stays frozen rather
 * than leaking English gaps onto the live site.
 */
async function runTranslationPipeline(code: string, name: string): Promise<ActionState> {
  const model = await getChatModel();
  const results: ModuleResult[] = [];

  for (const namespace of ALL_NAMESPACES) {
    results.push(await translateModule(code, name, namespace, model));
  }

  const withContent = results.filter((r) => r.total > 0);
  if (withContent.length === 0) {
    return { error: 'The word bank is empty — run `npm run i18n:extract` first.' };
  }

  const translated = withContent.reduce((sum, r) => sum + r.translated, 0);
  const total = withContent.reduce((sum, r) => sum + r.total, 0);
  const failed = withContent.filter((r) => r.error || r.translated === 0);

  if (translated === 0) {
    return { error: `Translation failed for "${name}" — no module returned usable output. Still frozen; retry when ready.` };
  }

  if (failed.length > 0) {
    const names = failed.map((r) => NAMESPACE_LABELS[r.namespace]).join(', ');
    return {
      error:
        `"${name}" (${code}) is partly translated — ${translated}/${total} strings across ` +
        `${withContent.length - failed.length}/${withContent.length} modules. Failed: ${names}. ` +
        `Left frozen so half-translated text can't reach the live site — retry to finish it.`,
    };
  }

  await db.update(locales).set({ status: 'active' }).where(eq(locales.code, code));
  return {
    success: `"${name}" (${code}) translated — ${translated}/${total} strings across ${withContent.length} modules — and activated.`,
  };
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

type ImportRow = { namespace: string; key: string; locale: string; value: string };

/**
 * Normalises the two shapes this accepts into DB rows:
 *
 *  1. The **side-by-side export** this app produces —
 *     `{ locale, rows: [{ module, key, en, target }] }`. Untranslated rows
 *     (empty `target`) are dropped rather than written as empty strings: an
 *     empty translation would shadow the English fallback with nothing.
 *  2. A **flat array** of `{namespace, key, locale, value}` — the older
 *     export shape, and the easiest thing to generate by hand or by script.
 *
 * Accepting our own export back is the round-trip a coworker workflow
 * depends on, so it is deliberately the first case handled.
 */
function normaliseImport(parsed: unknown): { rows: ImportRow[]; error?: string } {
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)) {
    const { locale, rows } = parsed as { locale?: unknown; rows: unknown[] };
    if (typeof locale !== 'string' || !locale) {
      return { rows: [], error: 'Side-by-side file is missing its top-level "locale".' };
    }
    const out: ImportRow[] = [];
    for (const raw of rows) {
      const r = raw as { module?: unknown; key?: unknown; target?: unknown };
      if (typeof r?.module !== 'string' || typeof r?.key !== 'string') {
        return { rows: [], error: 'Side-by-side file has a row missing "module" or "key".' };
      }
      if (typeof r.target !== 'string' || !r.target.trim()) continue; // untranslated — skip, don't blank it out
      out.push({ namespace: r.module, key: r.key, locale, value: r.target });
    }
    if (out.length === 0) return { rows: [], error: 'Nothing to import — every row has an empty translation.' };
    return { rows: out };
  }

  if (Array.isArray(parsed)) {
    const bad = parsed.some(
      (r) => !r?.namespace || !r?.key || !r?.locale || typeof r?.value !== 'string',
    );
    if (bad) return { rows: [], error: 'Malformed file — expected an array of {namespace, key, locale, value} objects.' };
    return { rows: parsed as ImportRow[] };
  }

  return {
    rows: [],
    error: 'Unrecognised file — expected this app\'s side-by-side export, or an array of {namespace, key, locale, value} objects.',
  };
}

/** Accepts this app's own side-by-side export (JSON), or a flat {namespace,key,locale,value} array. */
export async function importTranslationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to import.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: 'Not valid JSON.' };
  }

  const { rows, error: shapeError } = normaliseImport(parsed);
  if (shapeError) return { error: shapeError };
  if (rows.some((r) => r.locale === 'en')) {
    return { error: 'File contains locale="en" rows — English is never stored in translations (see docs/17-translations.md).' };
  }

  const unknown = [...new Set(rows.map((r) => r.namespace).filter((ns) => !isNamespace(ns)))];
  if (unknown.length > 0) {
    return {
      error:
        `Unknown module(s): ${unknown.join(', ')}. Valid modules are ${ALL_NAMESPACES.join(', ')} — ` +
        'a file exported before the word bank was split into modules needs re-exporting.',
    };
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
  // reviewed translation), so every locale it touches ends up `active` —
  // whether it's brand new *or* was left `pending` by a failed AI run.
  // Only creating unknown locales (and leaving an existing `pending` one
  // frozen) stranded exactly that case: a full, valid translation imported
  // by hand couldn't unfreeze the language it was for.
  const touchedLocales = [...new Set(rows.map((r) => r.locale))];
  const unfrozen: string[] = [];

  for (const code of touchedLocales) {
    const [existing] = await db
      .select({ code: locales.code, status: locales.status })
      .from(locales)
      .where(eq(locales.code, code))
      .limit(1);

    if (!existing) {
      await db.insert(locales).values({ code, name: code.toUpperCase(), status: 'active' });
      unfrozen.push(code);
    } else if (existing.status === 'pending') {
      await db.update(locales).set({ status: 'active' }).where(eq(locales.code, code));
      unfrozen.push(code);
    }
  }

  revalidatePath('/admin/translations');
  revalidatePath('/', 'layout');

  const suffix = unfrozen.length > 0 ? ` ${unfrozen.join(', ')} now active.` : '';
  return { success: `Imported ${rows.length} row(s) across ${touchedLocales.length} locale(s).${suffix}` };
}
