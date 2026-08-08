# Branding

Shipped 2026-08-07. Rebuilds `/admin/theme` (relabelled "Branding" in the nav — URL kept
unchanged) from a single always-one-row editor into a real CRUD list, and extends `themes` with
logo, favicon, and font fields.

## What changed

`themes` already supported multiple saved rows (`isActive` flag), but no admin UI could see or
manage more than the active one. Extended with four new nullable columns:

- `logo_url`, `favicon_url` — plain URLs, not file uploads, same convention as persona avatars and
  the frontpage editor's custom-section image field. `logoUrl` unset falls back to the built-in
  inline-SVG mark (`src/components/site/logo.tsx`) — never a broken image.
- `heading_font`, `body_font` — a curated key (`src/lib/branding/fonts.ts`: `inter`, `system`,
  `georgia`, `space-grotesk`, `jetbrains-mono`), not a full Google Fonts integration. Each key
  resolves to a real font stack; unset falls back to the site's default (Inter for body, same as
  body for heading). `globals.css` defines `--font-heading` (defaults to `--font-sans`) and applies
  it to `h1`–`h6`; the root layout overrides both as CSS variables when the active theme sets them.

Also expanded the color tokens exposed in the editor from 3 (`brand-500`, `brand-600`,
`accent-500`) to the real full set already defined in `globals.css`'s `@theme` block (`brand-50`–
`900`, `accent-400/500/600`) — "Primary" (the two used day to day) shown directly, the rest under a
collapsed "Advanced palette" `<details>`.

## Admin UI (`/admin/theme`)

Every saved theme in a card: name, active/inactive badge, **Set active** (only shown when not
already active), **Duplicate**, **Delete** (blocked — button hidden, and re-checked server-side —
on the currently-active theme). Each card's `ThemeForm` edits that one theme's tokens/logo/
favicon/fonts/custom CSS in place, with a live color preview.

`src/server/actions/admin-branding.ts`: `createThemeAction` (blank/default tokens, inactive),
`activateThemeAction` (deactivates every other row in a transaction, then activates the target —
exactly one theme is ever active), `duplicateThemeAction` (clones every field except `isActive`),
`deleteThemeAction`, `updateThemeAction` (replaces the old single-theme `saveThemeAction` in
`src/server/actions/admin.ts`, which is now edit-by-id instead of always upserting the row with
`slug='default'`).

## Where the site picks it up

`src/lib/branding/theme.ts`'s `getActiveTheme()` — one `unstable_cache` entry (1h, tag `theme`),
shared by the root layout, header, footer, and the auth layout (login/register), so a logo/theme
change is one cache entry to invalidate, not four. `revalidatePath('/', 'layout')` on every
branding write handles that.

- Root layout (`src/app/layout.tsx`): favicon into `generateMetadata`'s `icons`; heading/body font
  CSS variable overrides alongside the existing color-token `:root{}` injection; Space Grotesk and
  JetBrains Mono are always loaded via a Google Fonts `<link>` (same pattern the admin layout
  already used for its own fonts) so either curated choice works without a deploy.
- `Logo` (`src/components/site/logo.tsx`) takes an optional `srcUrl` — renders an `<img>` when set,
  the inline SVG otherwise. Wired into the public header, footer, and auth layout. The admin
  console's own logo (`src/app/admin/layout.tsx`) is intentionally left on the inline mark — the
  admin chrome's always-dark aesthetic is a deliberately separate style from the public site's,
  same reasoning as it having no light-mode toggle.

## Verified

Real admin-panel run (Playwright against the live site): created a second theme, set a logo URL and
a font, activated it, and confirmed `/` reflected the logo, the font stack, and the color tokens
simultaneously — then switched back to Default and confirmed a clean revert. Confirmed delete is
blocked on the active theme and succeeds once a theme is inactive (checked directly against the DB
after the run — no leftover test themes or sections). Full `typecheck`/`build`/`pm2 restart`/route
smoke test/clean error log alongside docs/19-frontpage-sections.md, since both shipped together.

One real bug caught during this verification pass, not by typecheck: the hero title's Zod schema
originally `.trim()`-ed `titleLead`, silently stripping the load-bearing trailing space between
"Your AI agency," and the gradient-highlighted "staffed by personas" — fixed in
`admin-frontpage.ts` (see docs/19-frontpage-sections.md), not this file, since the bug was in the
frontpage editor, not branding.
