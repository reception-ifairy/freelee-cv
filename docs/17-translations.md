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
(`src/lib/settings-schema.ts`, new `localization` group) — the raw settings-page text fields still
work (`/admin/settings?group=localization`) and needed **zero new code**, satisfying "only an admin
can change it globally" via the exact same `requireAdmin()` gate every other setting already has.
`/admin/translations` (below) is the real day-to-day interface — a proper picker limited to
locales that are actually translated, not a free-text field an admin could mistype.

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

## The admin panel: `/admin/translations`

The same pipeline, but triggered from a real UI instead of a terminal — this is the "intelligent
AI menu" the panel was asked for. `src/server/actions/admin-translations.ts`:

- **Add a language** (`addLocaleAction`): the admin types a plain language name — "German," not
  "de" — into one input. The action asks the AI for the ISO 639-1 code (`generateText()` with a
  one-line system prompt asking for just the code, no chat UI needed for that part — a single
  targeted call was simpler and more reliable than an open-ended conversational flow), inserts a
  new `locales` row as `status: 'pending'` immediately (the "freeze" — shows up in the panel as a
  dashed amber row, not selectable in the language picker), then runs the exact translation
  pipeline described above in the same request and flips the row to `active` on success (the
  "unfreeze"). A failure at any step leaves the locale `pending` with an error message rather than
  crashing — `retryLocaleAction` re-runs just the translation step for an existing pending row.
- **Language picker**: every `active` locale gets a "Set as frontend"/"Set as admin" button
  (`setActiveLocaleAction`) that writes straight to the `frontend_locale`/`admin_locale` settings —
  a `pending` locale is structurally incapable of appearing here (only `active` rows render a
  button at all), so there's no way to point the live site at a half-translated language even by
  mistake.
- **Export/Import**: `/admin/translations/export` (a `GET` route, `requireAdmin()`-gated) is the
  literal "export button" — downloads the whole `translations` table as JSON, same shape as
  `scripts/export-translations.ts`. The import form (`importTranslationsAction`) accepts that same
  shape back — a coworker's reviewed/hand-edited copy — and treats any locale it introduces as a
  complete, deliberate action: straight to `active`, never `pending`, since an import is someone's
  finished work, not a half-done AI draft.

`resolveLocale()` (`src/lib/i18n/translate.ts`) only ever treats a setting value as valid if
`locales` has an `active` row for it — a `pending` locale can never leak onto the live site even
if something else wrote a stale/wrong setting value by hand.

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

Migration `0015_translations.sql` (the `translations` table) and `0016_locales.sql` (the
`locales` registry, seeded with `en`/`pl` as `active`) — additive, nothing existing touched. Ran
the real CLI pipeline against production first: `i18n:extract` found 32 keys across the three
wired-up files with zero fallback conflicts; `i18n:translate` made a real `generateText()` call
and upserted 32/32 Polish rows (spot-checked several, including all three with `{placeholder}`
tokens — all preserved correctly, e.g. `"{count} specjalistów AI gotowych do pracy"`).

Then verified the **admin-panel path specifically** — the new logic (AI language-code detection,
the pending→active transition) — by running the exact same steps `addLocaleAction` runs, against
production, for a real language (German, not a throwaway test value): AI correctly resolved
"German" → `de`; inserted as `pending`; ran the real translation pipeline (32/32 keys, e.g.
`footer.company` → `"Unternehmen"`, correct); flipped to `active`. Flipped `frontend_locale` to
`de` directly in the database and confirmed the live site actually rendered in German
(`<html lang="de">`, "Anmelden"/"Loslegen"/"Unternehmen" all present, zero server errors), then
back to `pl` to confirm that still worked too, then reverted to `en` as the shipped default —
German is left `active` in the `locales` table (a real, useful addition, not test data to clean
up); an admin picks it for real via `/admin/translations` whenever ready. `npm run typecheck`/
`npm run build` clean; `npm run modules:verify` — 9 modules registered, all dependencies resolve.

## What's next

Phase 2 (admin panel) wires `getAdminT()` into `/admin/**` pages the same way this phase wired
`getFrontendT()` into the frontend — the mechanism already exists and doesn't need to change, only
the call sites need adding, file by file, same extraction/translation pipeline, same
`/admin/translations` panel to drive it.
