# Public Site

## Visual identity — "developer dark"

As of 2026-08-03 the public site defaults to dark mode ("developer dark" — true black background,
indigo brand accent, glow highlights), a deliberate departure from the previous light-first design.

- **Dark by default, not just by system preference**: the pre-paint bootstrap script in
  `src/app/layout.tsx` adds the `dark` class unless `localStorage.theme === 'light'` — i.e. dark is
  the house style, and a visitor has to opt *out* via the header `<ThemeToggle />`, not opt in.
- **True black, not navy**: `body`'s dark background is `bg-black`, not the previous
  `dark:bg-slate-950` (`#020617`, which reads as navy).
- **Glow utilities** (`globals.css`, inside `@layer utilities`): `.glow-text` (text-shadow halo,
  used on the hero's gradient-accented word), `.glow-btn` (box-shadow glow on primary buttons,
  applied via the shared `Button` component's `primary` variant so it's automatic everywhere), 
  `.glow-ring` (used on badges and the bottom CTA panel). All are scoped `.dark .glow-*` so light mode
  is completely unaffected.

## Homepage — editable without a redeploy

`src/app/(marketing)/page.tsx` reads hero/CTA copy from the `settings` table's `homepage` group
(`hero_title`, `hero_subtitle`, `hero_primary_label`, `hero_secondary_label`, `cta_title`,
`cta_subtitle`, `cta_button_label`) via `getSettingString`, with the original hardcoded copy as the
fallback default — so nothing changes visually until an admin edits
`/admin/settings?group=homepage`. `hero_title` supports a `||` separator to mark which portion gets
the gradient/glow treatment (e.g. `"Your AI agency, ||staffed by personas"`).

## `/bionic` — a second marketing page

A dark, neon "bionic bot organism" themed page (ported from a Personat.AI reference build), linked
from the header nav as "Bionic Core." Self-contained visual component, not wired into the
settings-driven copy system above.

## Header / footer

`site_name`/`site_description` settings already drive the brand name and tagline shown in both — no
hardcoding. `SiteHeader` also shows the signed-in user's credit balance and a `<ThemeToggle />`.

## Chat

`/chat/[id]` (authenticated) — streams via `src/app/api/chat/route.ts`, Node runtime (long-running
streams need it), `X-Accel-Buffering: no` so nginx doesn't buffer the stream. Guests get a limited
number of free messages (`guest_free_messages` setting) tracked via a cookie-based `guestToken()`
before being asked to sign up.
