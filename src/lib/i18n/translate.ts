import 'server-only';
import { cache } from 'react';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { translations, locales } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { FRONTEND_NAMESPACES, ADMIN_NAMESPACES } from './namespaces';
import type { Namespace } from './namespaces';

export type { Namespace } from './namespaces';

/** Any string the `locales` table has an `active` row for — see /admin/translations, docs/17-translations.md. */
export type Locale = string;

/**
 * DB-backed, not a hardcoded array — `/admin/translations`'s whole point is
 * adding a language without a code change. `en` is always active (seeded by
 * migration 0016, and this app has no code path that ever un-seeds it).
 */
const getActiveLocaleCodes = cache(async (): Promise<Set<string>> => {
  const rows = await db.select({ code: locales.code }).from(locales).where(eq(locales.status, 'active'));
  return new Set(rows.map((r) => r.code));
});

/**
 * English is never stored in `translations` — it's always the literal
 * fallback string already sitting at each `t(key, fallback)` call site, so
 * there's no row to keep in sync and nothing can go stale. Only a non-'en'
 * locale needs a real query.
 *
 * Loads **every** namespace in the surface at once (one `inArray` query, not
 * one per module) — the bank is modular for authoring and translation, but a
 * page render shouldn't pay 9 round-trips for that.
 */
const getTranslationMap = cache(
  async (namespaceKey: string, locale: Locale): Promise<Map<string, string>> => {
    if (locale === 'en') return new Map();
    const namespaces = namespaceKey.split(',') as Namespace[];

    const rows = await db
      .select({ key: translations.key, value: translations.value })
      .from(translations)
      .where(and(inArray(translations.namespace, namespaces), eq(translations.locale, locale)));

    return new Map(rows.map((r) => [r.key, r.value]));
  },
);

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

/**
 * A `pending` (mid-AI-translation, "frozen" in the admin UI) locale is never
 * resolved here even if a setting somehow points at it — only `active` rows
 * count, so a half-finished language can never leak onto the live site.
 */
async function resolveLocale(surface: 'frontend' | 'admin'): Promise<Locale> {
  const settingKey = surface === 'frontend' ? 'frontend_locale' : 'admin_locale';
  const raw = await getSettingString(settingKey, 'en');
  if (raw === 'en') return 'en';
  const active = await getActiveLocaleCodes();
  return active.has(raw) ? raw : 'en';
}

/**
 * The frontend/landing surface's translator — global, admin-controlled via
 * `/admin/translations`, not a per-visitor preference. Call once per
 * page/layout (it's `cache()`-backed like `getSettings()`, so asking for it
 * from several components in one render pass still issues at most one
 * query) and pass `t` down, or call this again — same result, deduplicated
 * automatically.
 */
export async function getFrontendT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await resolveLocale('frontend');
  const map = await getTranslationMap(FRONTEND_NAMESPACES.join(','), locale);
  return { t: makeTranslator(map), locale };
}

/** The admin panel's translator — independent of the frontend's language. */
export async function getAdminT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await resolveLocale('admin');
  const map = await getTranslationMap(ADMIN_NAMESPACES.join(','), locale);
  return { t: makeTranslator(map), locale };
}
