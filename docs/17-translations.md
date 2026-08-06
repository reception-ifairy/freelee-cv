# Translations

Shipped 2026-08-06 — Phase 1 (frontend/landing) of the translation module. Requested explicitly as
a global, admin-controlled site language (Polish alongside English), **not** a per-visitor
preference — two independent settings, one for the public frontend, one for the admin panel
(the latter built as infrastructure only this phase; no admin-panel text is wired up yet).

## The core idea: English never leaves the source code

Every translatable string is a call site: `t('namespace.key', 'The exact English text that was
already there')`. The English fallback is the literal string already sitting in the JSX — not a
row anywhere. Only non-English locales ever get a `translations` table row
(`src/db/schema.ts`). This has one big consequence, and it's the whole reason the architecture
looks the way it does: **a missing or stale translation can never produce a blank string or a
crash** — it silently falls back to the English text that was always there. The same fail-open
philosophy `getSettingString(key, fallback)` already uses everywhere else in this app, applied to
translated strings instead of admin-editable settings.

## Architecture: chosen over JSON message-catalog files or a full i18n framework

The plan asked me to pick between something like PHP-style translation files, SQL/a database
table, or static JSON catalogs (`next-intl`-style). Went with a **DB-backed `translations` table**
(`namespace`, `key`, `locale`, `value` — unique on the first three), not static JSON files
committed to the repo, for one deciding reason: this app is already thoroughly a
database-driven CMS (`settings`, `posts`, `pages`, `menuItems` are all admin-editable at runtime,
zero redeploy) — a translation catalog that required a `git commit` + redeploy to fix a typo would
be the odd one out, not the norm, in this codebase. `getFrontendT()`/`getAdminT()`
(`src/lib/i18n/translate.ts`) fetch the whole namespace+locale map in one query, `cache()`-wrapped
exactly like `getSettings()` — so a page that calls it from three different components still
issues one query per render pass, not three.

`namespace`/`locale` are plain `text` columns, not enums — the same reasoning as
`personas.modelTier`: closed vocabularies that are still just app config, not worth a migration to
add a third locale or a third namespace later.

## Global, not per-visitor — the whole point

`frontend_locale` and `admin_locale` are two new entries in the existing `SETTINGS_SCHEMA`
(`src/lib/settings-schema.ts`, new `localization` group) — meaning the entire existing
schema-driven settings UI (`/admin/settings?group=localization`, `SettingsForm`,
`saveSettingsAction`) needed **zero new code** to become the admin's language switcher. This was a
deliberate architecture win, not a coincidence: reusing the settings system that already existed
meant the "only I as admin can change it globally" requirement was satisfied by the exact same
`requireAdmin()` gate every other setting already has, for free.

No URL locale prefixes (`/en/...`, `/pl/...`), no cookie-based per-visitor picker, no middleware
locale-detection — every one of those is the standard shape for typical multi-locale i18n, and
every one of them was the wrong shape for what was actually asked for here. One value, one
`<html lang>`, every visitor sees the same language until an admin changes the setting.

## The "word bank" pipeline

Two scripts, matching the two-step process asked for directly:

1. **`npm run i18n:extract`** (`scripts/extract-translations.ts`) — scans an explicit, growing list
   of files registered per namespace (currently: `header.tsx`, `footer.tsx`, the home page) for
   `t('key', 'fallback')` call sites via regex, and writes every unique key found into
   `i18n/frontend.en.json` — the literal "bank of words to translate." Scoped to a known file list,
   not a blind codebase-wide scan, since only files actually wired up to `getFrontendT()` have real
   calls to extract — registering a new file here is the same change as wiring it up.
2. **`npm run i18n:translate`** (`scripts/translate-bank.ts`) — reads that bank, sends the whole
   JSON object in one `generateText()` call to the platform's own configured OpenAI provider
   (reusing the same `ai_providers`/`ai_models` catalog every other AI feature in this app uses,
   not a new provider integration), asks for natural/idiomatic UI phrasing (not literal
   word-for-word translation) with `{placeholder}` tokens preserved verbatim, and upserts the
   result into `translations`.

Both scripts build their own raw Drizzle client rather than importing `@/lib/ai/registry` or
`@/db` directly — both of those import `server-only`, which throws outside a Next.js server
context, the same constraint every script in this project has hit since Phase 6.

## What's translated this phase, and what deliberately isn't

**Wired up**: the shared site header and footer, and the full home/landing page (badge, hero
stats, "Featured personas"/"Three steps"/"Simple credit packs"/"From the blog" sections and their
body copy). 32 keys, all translated and verified live.

**Deliberately not translated this phase**:
- `hero_title`/`hero_subtitle`/`cta_title`/`cta_subtitle`/`cta_button_label`/`site_name`/
  `site_description` — these already come from the `settings` table via `getSettingString()`, a
  different, already-existing, more flexible system (admin can type literally anything there,
  already, in any language) — just not one that varies by locale yet. Left alone rather than
  bolted onto two different content systems in one pass.
- The rest of the public site (pricing, blog, personas catalog, login/register), the full
  logged-in app (chat, dashboard, rooms, crews, marketplace), and the entire admin panel — all
  explicitly later increments of the same phased approach, not this pass. `admin_locale` exists as
  a real setting and `getAdminT()` is real, working infrastructure — no admin-panel page calls it
  yet.
- Dynamic content (persona names/descriptions, blog post bodies, category names) — a fundamentally
  different, much larger feature (per-row content translation, not per-string UI translation) that
  was explicitly scoped out in favor of static UI text only.

## Coworker workflow

`docs/15-data-portability.md`'s export/import pattern, reused for a genuinely different kind of
data (translations aren't team-scoped at all — the whole point is one shared, admin-controlled
value): `npm run i18n:export`/`npm run i18n:import` (`scripts/export-translations.ts`/
`import-translations.ts`) dump and restore the whole `translations` table as one flat JSON array,
letting a coworker review or hand-edit translations locally without production DB access, same
private-channel-not-git rule as the data bundle export in `CONTRIBUTING.md`. Full walkthrough
(including the extract/translate pipeline for adding new strings) is in `CONTRIBUTING.md` §5.

## Verifying it

Migration `0015_translations.sql` — one new table, nothing existing touched. Ran the real
pipeline against production, not a test fixture: `i18n:extract` found 32 keys across the three
wired-up files with zero fallback conflicts; `i18n:translate` made a real `generateText()` call
and upserted 32/32 Polish rows (spot-checked several, including all three with `{placeholder}`
tokens — all preserved correctly, e.g. `"{count} specjalistów AI gotowych do pracy"`). Flipped
`frontend_locale` to `pl` directly in the database, confirmed the live site actually rendered in
Polish (`<html lang="pl">`, every section's heading correctly translated, zero server errors),
then reverted to `en` as the shipped default — an admin flips it for real via
`/admin/settings?group=localization` whenever ready. `npm run typecheck`/`npm run build` clean;
`npm run modules:verify` — 9 modules registered, all dependencies resolve.

## What's next

Phase 2 (admin panel) wires `getAdminT()` into `/admin/**` pages the same way this phase wired
`getFrontendT()` into the frontend — the mechanism already exists and doesn't need to change, only
the call sites need adding, file by file, same extraction/translation pipeline.
