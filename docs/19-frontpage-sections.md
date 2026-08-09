> **Superseded.** This page describes the first frontpage editor. It was rebuilt as a general block
> builder in `docs/33-block-builder.md` — 17 block types, a shared grid system, drag and drop, and
> the same blocks on CMS pages and blog posts. This page is kept because it records why the
> `page_sections` table was shaped the way it was, which is what made the rebuild additive.

# Frontpage Sections

Shipped 2026-08-07. Replaces the home page's fixed, hardcoded sequence of 7 JSX sections with an
ordered, admin-editable list (`page_sections` table) — reorder, hide, and edit content from
`/admin/frontpage` with no deploy.

## The model

`page_sections`: `page` (text, default `'home'` — scoped for one page today, not architecturally
locked to it), `type`, `position`, `is_visible`, `config` (jsonb), timestamps.

Seven **core** types are singletons, seeded once by `drizzle/0018_page_sections.sql` and never
creatable/deletable through the UI (enforced in `deleteCustomSectionAction`, not a DB constraint —
there's deliberately no unique index on `(page, type)` since it would need to exclude the one
genuinely repeatable type, `custom_content`):

| type | config? | notes |
|---|---|---|
| `hero` | yes | title/subtitle/button labels |
| `categories` | no | pure DB-driven, copy stays `t()`-driven |
| `featured_personas` | no | pure DB-driven, copy stays `t()`-driven |
| `how_it_works` | yes | 3 steps (icon/title/body); heading/subtitle stay `t()`-driven |
| `pricing` | no | pure DB-driven, copy stays `t()`-driven |
| `blog` | no | pure DB-driven, copy stays `t()`-driven |
| `cta` | yes | title/subtitle (supports a `{credits}` placeholder)/button label |

One repeatable type, `custom_content` (heading, Markdown body, optional image URL, optional CTA
label+href) — the actual "add a new kind of section" extensibility point, add as many as wanted.

## Where the translation boundary was drawn

`categories`/`featured_personas`/`pricing`/`blog` have no `config` — they're pulled live from
existing data (personas, categories, credit packs, posts) and their static copy (headings,
subtitles) stays translation-driven via `getFrontendT()`, exactly as before this system existed.
`hero`/`how_it_works`/`cta` had copy that was either hardcoded or settings-driven before this
change — that content moved into `config`, which is the section editor's domain now, not
translations'. This is a deliberate boundary, not an oversight: once content has a `config`
representation, editing it through `/admin/translations` too would mean two admin systems able to
edit the same string, which is worse than picking one.

The migration backfilled `hero`/`cta`'s `config` from the exact English fallback text that was
already live (confirmed via `psql` that no `settings` rows for `hero_*`/`cta_*` had ever actually
been set) — the `homepage` group in `SETTINGS_SCHEMA` was removed afterward, now dead code.

## Rendering

`src/components/site/sections/*.tsx` — one small async Server Component per type. `(marketing)/page.tsx`
fetches `page_sections` for `page='home'`, filters `isVisible`, orders by `position`, and only runs
each visible section's own DB query — a real perf win over the old page's unconditional fetch of
all seven every render. `src/components/site/sections/index.ts`'s `renderSection(type, config)`
dispatches each row to its component; an unrecognised `type` renders nothing (`return null`) rather
than crashing the page — same fail-open posture as knowledge sources and translations.

## Admin UI (`/admin/frontpage`)

Ordered list of sections: visibility toggle, move up/down (two buttons, not drag-and-drop — no DnD
library is a dependency today and this delivers the same capability), and an inline edit form for
the four configurable types. "Add custom section" appends a new `custom_content` row at the end.

`src/server/actions/admin-frontpage.ts`: `toggleSectionAction`, `moveSectionAction` (swaps
`position` with the adjacent row — a plain integer swap, not a full renumber),
`updateHeroConfigAction`/`updateCtaConfigAction`/`updateHowItWorksConfigAction`/
`updateCustomContentConfigAction` (typed per-type forms, not one raw-JSON textarea — matches every
other admin form in this app and can't produce a shape the renderer doesn't expect),
`createCustomSectionAction`, `deleteCustomSectionAction` (only ever targets `type='custom_content'`
rows — checked in the action itself, not just hidden in the UI). Every action calls
`revalidatePath('/')` — the home page is ISR (`revalidate = 300`), so without this an edit wouldn't
show up for up to 5 minutes.

One caveat found and fixed during verification: `hero.tsx` renders `{titleLead}{titleAccent}` back
to back with no separator, so a deliberate trailing space in `titleLead` (e.g. `"Your AI agency, "`)
is load-bearing. The Zod schema for that one field intentionally does **not** `.trim()` — it
validates non-empty via `.trim().length > 0` but stores the original string, so a trailing space
survives a save.

## Verified

Real admin-panel run (Playwright against the live site, not just typecheck/build): toggled a
section off/on and confirmed the change on `/` without waiting for the 5-minute ISR window; edited
the hero title and confirmed it on `/`, then reverted; added a `custom_content` section, confirmed
it rendered on `/`, then deleted it and confirmed the "can't delete a core section" guard holds
(only `custom_content` rows expose a Delete button, and the action re-checks `type` server-side).
