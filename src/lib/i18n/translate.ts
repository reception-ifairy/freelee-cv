import 'server-only';
import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { translations } from '@/db/schema';
import { getSettingString } from '@/lib/settings';

export type Namespace = 'frontend' | 'admin';

/**
 * Only two today; a plain array (not an enum-backed type) because adding a
 * third locale should never need a migration — see the schema comment on
 * `translations` for why `locale`/`namespace` are just `text` columns.
 */
export const SUPPORTED_LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * English is never stored in `translations` — it's always the literal
 * fallback string already sitting at each `t(key, fallback)` call site, so
 * there's no row to keep in sync and nothing can go stale. Only a non-'en'
 * locale needs a real query.
 */
const getTranslationMap = cache(async (namespace: Namespace, locale: Locale): Promise<Map<string, string>> => {
  if (locale === 'en') return new Map();

  const rows = await db
    .select({ key: translations.key, value: translations.value })
    .from(translations)
    .where(and(eq(translations.namespace, namespace), eq(translations.locale, locale)));

  return new Map(rows.map((r) => [r.key, r.value]));
});

export type Translator = (key: string, fallback: string, vars?: Record<string, string | number>) => string;

function makeTranslator(map: Map<string, string>): Translator {
  return (key, fallback, vars) => {
    let value = map.get(key) ?? fallback;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  };
}

async function resolveLocale(namespace: Namespace): Promise<Locale> {
  const settingKey = namespace === 'frontend' ? 'frontend_locale' : 'admin_locale';
  const raw = await getSettingString(settingKey, 'en');
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : 'en';
}

/**
 * The frontend/landing surface's translator — global, admin-controlled via
 * `/admin/settings?group=localization`, not a per-visitor preference. Call
 * once per page/layout (it's `cache()`-backed like `getSettings()`, so
 * asking for it from several components in one render pass still issues at
 * most one query) and pass `t` down, or call this again — same result,
 * deduplicated automatically.
 */
export async function getFrontendT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await resolveLocale('frontend');
  const map = await getTranslationMap('frontend', locale);
  return { t: makeTranslator(map), locale };
}

/**
 * The admin panel's translator — independent of the frontend's language.
 * Infrastructure only this phase: the setting exists and this function
 * works, but no admin-panel page has been wired up to call it yet (phase 2,
 * not built this pass — see docs/17-translations.md).
 */
export async function getAdminT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await resolveLocale('admin');
  const map = await getTranslationMap('admin', locale);
  return { t: makeTranslator(map), locale };
}
