# Theme composer

Ported from **vizai.art** (`/var/www/vizai.art`), whose `ThemeChanger.tsx` and `lib/theme.ts` ship a
set of complete, named palettes applied live as CSS variables.

## What was wrong here

`themes.tokens` overrides Tailwind's colour scales — thirteen tokens across `brand-50…900` and
`accent-400…600`. The admin form exposed **three** of them: `brand-500`, `brand-600`, `accent-500`.

So changing the brand to green left the other seven brand stops indigo. Tints, hovers, badges and
every dark-mode surface quietly disagreed with the colour that had just been picked, and the only
fix was opening "Advanced palette" and matching ten shades by eye.

## What replaced it

| File | Role |
|---|---|
| `src/lib/branding/palette.ts` | colour maths, ramp generator, presets, WCAG contrast (**plain module**) |
| `src/components/admin/theme-composer.tsx` | presets, seeds, the scale, readability, preview |

### One colour generates the scale

Pick a main colour; `rampFromSeed()` produces all ten stops. **The seed becomes `brand-600`
exactly** — the stop the UI paints primary buttons and links with, which is what the field promises.
Everything else interpolates out towards near-white and near-black around it, so the ramp keeps a
consistent rhythm whatever colour is chosen.

This is the part vizai does by hand: it ships ten fully hand-written palettes. Generating them means
any colour works, not only the ten someone drew.

### Presets

Ten starting points, several carried over from vizai by name — Dark Luxury, Minimal Light, Neon
Cyberpunk, Crimson Sunset, Emerald Forest, Amethyst Dream, Aurora Mint, Luminous Paper, Pure Black,
plus the shipped Indigo. Picking one fills the seeds; both colours stay editable afterwards, and any
individual shade can still be overridden by hand (marked with a dot, with a reset).

### Readability, which vizai does not have

Four live WCAG contrast readouts: button text, link on white, link in dark mode, accent on white —
each with a ratio and an AAA/AA/AA-Large/Fail verdict.

A composer that lets an admin pick unreadable text is worse than no composer, because the failure
only appears for the people least able to work around it.

**It immediately found something.** The shipped default accent (`#f59e0b` amber) scores
**2.1:1 — Fail** on white. That has been the live theme all along and nobody could see it.

### Preview

Light and dark cards side by side, showing a heading, body copy, primary and secondary buttons, a
badge, a link and an accent chip — the combinations that actually break when a palette is wrong.

## Server-side validation

`updateThemeAction` previously stored any non-empty string under any `token.*` key. Tokens are
emitted straight into a `<style>` block as `--color-<key>: <value>`, so both halves are now checked:
the key against `^(brand|accent)-(50|100|…|900)$`, the value as a hex colour. An unchecked key could
otherwise close the declaration and write arbitrary CSS into every page.

## Two bugs the tests caught, not the reading

The ramp generator was wrong twice, and both times the unit test is what showed it:

1. **Fixed lightness per stop.** Kept only the seed's hue and saturation, so Emerald Forest's deep
   `#059669` came back as neon `#08f7ad` at `brand-600` — a mint button from a "deep green, calm and
   natural" preset.
2. **Anchoring to the seed's *natural* stop.** The colour was then genuinely in the ramp, but a dark
   seed landed at `brand-800`, so the button was still mint.

Both are why the seed is now pinned to 600.

## What was verified

`scripts/verify-palette.ts` — **31/31**, wired into `npm run blocks:verify`:

hex parsing and round-trips · every stop a valid hex · the ramp darkens monotonically 50→900 · hue
survives · a grey seed still ramps · an invalid seed yields nothing · **the seed is exactly
`brand-600`** for dark, mid, light and very dark seeds · the accent seed is exactly `accent-600` ·
only the three accent stops used are written · contrast is symmetric, black-on-white is 21:1 · the
four WCAG thresholds · seed recovery from saved tokens, including junk.

Live, as an admin:

| Check | Result |
|---|---|
| Ten presets, ten ramp swatches, four contrast cards | ✅ |
| Picking Emerald Forest sets the seed | ✅ `#059669` |
| `brand-600` regenerates to the seed | ✅ `#059669` |
| Saving writes all thirteen tokens | ✅ |
| The **live site** turns emerald — logo, badge, headline, button, glow | ✅ |
| Restoring the default returns the page byte-for-byte | ✅ same sha256 |

## A caching gotcha worth knowing

`getActiveTheme()` is `unstable_cache(..., { revalidate: 3600, tags: ['theme'] })`, and Next
persists that to `.next/cache`. Editing `themes` **directly in SQL** does not change the site until
the tag is revalidated or the cache is cleared — the admin action does revalidate, so this only bites
when poking the database by hand. It cost ten confused minutes here.

## Still open

- Only `brand` and `accent` are composable. Surfaces and text greys still come from Tailwind's slate
  scale, so a "warm paper" or "true black" background is not yet a setting — that is the natural
  next step, and it is what vizai's `bgPrimary/bgSurface/bgElevated` tokens do.
- No per-theme dark-mode override; dark mode derives from the same ramp.
- The composer does not warn when a preset itself fails contrast — it shows the verdict and leaves
  the judgement to you.
