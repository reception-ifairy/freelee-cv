# Admin Panel

`/admin/**`, gated by `src/app/admin/layout.tsx` (`currentUser()` + `isAdmin` check — redirects to
`/login` or `/` otherwise). Self-contained: no external control plane, no T1000 dependency (that
integration existed in the dead legacy tree and was fully removed 2026-08-03).

## Visual identity — "developer console"

As of 2026-08-03, `/admin` has its own distinct dark identity, separate from the public site's indigo
brand:

- **Scoped via `.admin-console`** — a class on the admin layout's outer wrapper, declared inside
  `@layer components` in `src/app/globals.css` (a bare top-level CSS rule gets silently dropped by the
  build; it must live in a `@layer`). Overrides `--color-brand-*` (cyan, `#0ea5e9`, i.e. Tailwind
  sky-500) and `--color-slate-{950,900,800,700}` (true near-black remap) and `--font-mono`
  (JetBrains Mono). Because every shared UI primitive (`Button`, `Badge`, `Card`, `Table`,
  `field.tsx`) already consumes these same CSS variable names, the whole panel re-skins with **zero
  JSX changes** — CSS custom properties resolve from the nearest ancestor that declares them.
- **Admin always renders dark** — no `<ThemeToggle />` in the admin header; this aesthetic has no
  light variant.
- **Glow utilities** (`glow-text`, `glow-btn`, `glow-ring` in `globals.css`) reused from the public
  site's own dark-mode work, but since they read `var(--color-brand-*)` they automatically pick up
  admin's cyan instead of the public site's indigo.

If a future admin page looks unstyled/wrong, the most likely cause is a bare CSS rule outside a
`@layer` block — check the compiled chunk (`.next/static/chunks/*.css`) for the literal string before
assuming a logic bug.

## Navigation sections (`SECTIONS` in `admin/layout.tsx`)

| Section | Pages |
|---|---|
| — | Dashboard (`/admin`) |
| AI | Personas, Categories, Sectors, Prompt modifiers |
| Commerce | Credit packs, Sales, Customers |
| Content | Blog, Pages, Menus |
| System | Settings, Appearance, **Documentation** (this doc site) |

## Personas (`/admin/personas`)

The most complex form in the app (`src/components/admin/persona-form.tsx`), six tabs:

1. **Basics** — name, slug, tagline, description, expertise, avatar, accent color.
2. **Prompt** — `systemPrompt`, `welcomeMessage`, suggestions, and the raw-JSON `blueprint` editor.
3. **Model** — tier picker (Fast/Balanced/Advanced) as the primary control, with an "advanced" toggle
   revealing the raw provider + model `<select>`. See `02-ai-models.md`.
4. **Personality** — audience type, **audience segments** (collapsible B2C/B2B/B2G groups, added
   2026-08-03 — see `05-uk-taxonomy.md`), knowledge domains, grounding sources, personality trait
   sliders.
5. **Capabilities** — the boolean capability grid, plus **guardrails** (grouped by severity, added
   2026-08-03 — see `05-uk-taxonomy.md`).
6. **Publishing** — categories, credits per message, premium/featured/active flags, position.

## Categories & Sectors (`/admin/categories`, `/admin/sectors`)

Categories gained a real edit page 2026-08-03 (`category-form.tsx` + `[id]/page.tsx` — previously the
admin panel could only *create* categories, never edit existing ones) plus UK market-context fields
(market size, growth rate, key regulations, industry bodies, default risk level, narrative
potential). Sectors are an entirely new sub-taxonomy (own top-level nav item, not nested under
category editing) with B2C/B2B/B2G suitability sliders. Full detail: `05-uk-taxonomy.md`.

## Settings (`/admin/settings`)

Groups: `general`, `homepage` (hero/CTA copy for the public landing page — added so marketing copy
doesn't need a code change), `ai` (own dedicated card-based UI, see `02-ai-models.md`), `billing`,
`analytics`. Adding a field to any group other than `ai` is a one-line change in
`src/lib/settings-schema.ts` — the generic `SettingsForm` component picks it up automatically.

## Appearance (`/admin/theme`)

Public-site design tokens only (brand/accent colors, custom CSS) — injected live, no rebuild
required. Does **not** touch the admin console's own styling (see above).

## Everything else

Credit packs, Sales, Customers, Blog, Pages, Menus, Prompt modifiers follow a consistent CRUD
pattern: a list page with an `InlineForm` or link-to-`/new`, a Zod schema + server action pair in
`src/server/actions/admin.ts`, and (for the more complex entities) a dedicated `*-form.tsx` client
component. New entities in this app should follow the same shape rather than inventing a new pattern.
