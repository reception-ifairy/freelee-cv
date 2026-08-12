# The admin visual system

A visual pass over the admin console, staged. This page covers **Stage 1: the foundation** —
tokens, one surface recipe, the missing primitives, and a motion system. Nothing here is a feature;
everything later depends on it.

## What was actually wrong

An audit of all 35 admin routes found the problems were structural rather than decorative — whole
categories of UI vocabulary were missing, not badly styled:

| | Before |
|---|---|
| Design tokens | Fonts and colour ramps only. No radius, motion, or elevation — so `rounded-xl` (74 uses) and `rounded-2xl` (23) had drifted apart with no rule distinguishing them |
| Surfaces | **Four** competing recipes, from drift not intent |
| Motion | Two `@keyframes` in the codebase, **neither used in admin**. Modals and menus mounted with `if (!open) return null` |
| `prefers-reduced-motion` | **Nowhere in the codebase** |
| Loading states | **Zero** `loading.tsx` files app-wide. Zero `Suspense`. Zero skeletons |
| Numbers | The dashboard bar chart was the only visualization in the panel |

## Two live bugs this turned up

**The admin header's logo tile was transparent, not mis-coloured.** `--color-brand-950` was never
defined, so `bg-brand-950/50` painted nothing.

The fix was less obvious than it looks, and only a browser check caught it. Defining the token in
`.admin-console` made it *resolve* — and the tile stayed `rgba(0,0,0,0)`. Tailwind generates a
utility from the `@theme` namespace: with no `--color-brand-950` there, `bg-brand-950/50` was
**never emitted at all**. It has to be in both places — `@theme` registers the utility,
`.admin-console` re-points it at the sky ramp.

**`.glow-btn:hover` changed `box-shadow` with no `transition` on it.** It only appeared to animate
because `Button` carries a blanket `transition` class; everything else using `.glow-btn` — Badge's
brand tone, CardRadioGroup's selected state — snapped.

## Motion

Four movements, all opacity plus a small translate or scale. Nothing travels far, nothing
overshoots, nothing delays a click: `fade-in`, `scale-in`, `slide-up`, `shimmer`, plus a `stagger`
that reads its delay from a CSS variable so one class serves any list.

Three durations — 120ms for menus, 160ms for panels, 220ms for route changes. The scale is
deliberately short: a long menu of timings is a long menu of ways for two components to disagree.

**Route transitions use the View Transitions API**, not a library — the browser snapshots the old
page and cross-fades it, costing no JavaScript and no bundle. Unsupported browsers get today's
instant swap. Scoped to `.admin-console`: a cross-fade suits a tool you navigate dozens of times an
hour, but the public site's pages are content, and a fade there sits between a visitor and what they
came to read.

### The reduced-motion guard

For some people motion is not decoration but nausea, and the OS setting is how they say so. One
global rule, because a per-component opt-out is a per-component thing to forget.

Durations go to ~0 rather than `animation: none` deliberately: **an animation that never runs never
fires `animationend`**, which would strand any component waiting for it mid-unmount. It also fixes
`scroll-behavior: smooth`, unguarded since the day it was added.

Verified on two real browser contexts — 160ms → 0.01ms, `scroll-behavior` → `auto`.

## One surface recipe

The glass recipe wins because it is the one that works on both grounds: a translucent white lifts
off whatever is behind it, where an opaque `slate-900` only looks right on exactly the background it
was picked against — and `.admin-console` re-binds `--color-slate-900` to near-black, so that
assumption was already false in the admin.

`Card` gains `interactive` (hover response, only for cards that actually lead somewhere) and
`padding`, since every caller was passing `p-4`/`p-5` by hand.

## New primitives

| Component | Why |
|---|---|
| `Meter` / `MeterGroup` | Numbers that exist only to be compared were rendered as text — sector suitability as the string `"70 / 40 / 20"`. Drops into all 16 lists with **no contract change**: `ResourceItem.meta.value` was already typed `React.ReactNode` |
| `Sparkline` | Inline SVG polyline, ~30 lines. No charting library, matching the decision already written into the dashboard |
| `Skeleton*` | Mirrors the *shape* of what is coming — grid, table, stat row — so the layout does not jump and the eye knows where to look |
| `EmptyState` | An empty list is almost always someone's first visit to that screen, and the one question they have is "so what do I do here" |
| `StatTile` | `Stat` was label + number, so "Revenue £4,210" never said whether that was a good week. Adds `trend`, `spark`, `icon` |
| `Button loading` | 13 forms hand-wired `useFormStatus` + `Loader2` + a swapped label — 13 chances to forget the `disabled` and let someone submit twice. Sets `aria-busy`, because disabling alone announces nothing |

`useMountTransition` keeps overlays mounted through their exit animation. It uses a timer rather
than `animationend`: under reduced motion the duration is ~0 and the event may never fire, and a
timeout always resolves, so a panel can never get stuck half-closed.

## Loading states

`loading.tsx` on 15 routes. This is the largest perceived-speed win in the stage — navigation used to
freeze the previous screen until the server answered, which reads as a click that did not register
rather than a slow one.

## Verified

| Check | Result |
|---|---|
| `--color-brand-950` emits and the logo tile paints | ✅ `rgba(0,0,0,0)` → `oklab(0.293…/0.5)` |
| `rounded-card` emits from the token | ✅ 16px |
| `Card` renders the glass surface | ✅ bg `white/0.03`, border `white/0.1` |
| Reduced motion honoured | ✅ 160ms → 0.01ms; `scroll-behavior` → `auto` |
| Action menu animates | ✅ `slide-up` |
| Every admin route | ✅ 200, no client errors |
| All verification suites | ✅ 103 assertions + changelog |

## Still ahead

Stage 2 (sidebar: active route, group-coloured icons, mobile drawer), Stage 3 (all 16 lists),
Stage 4 (dashboard and detail screens). Stages 2–4 are independent of each other.

---

# Stage 2 — the sidebar

The weakest surface in the panel, and the one every session starts at.

## You could not see where you were

`admin/layout.tsx` was an async Server Component that never read `usePathname`, so all 23 links
rendered identically — no `aria-current`, no highlight, nothing. `settings-nav.tsx` already did this
correctly; the main nav simply never caught up.

Fixed by splitting the nav into data (`lib/admin/nav.ts`) and rendering (`admin-nav.tsx`, a client
component). Matching is **longest-prefix**, so `/admin/personas/769` and `/admin/personas/convert`
both highlight *Personas* — a detail page is still that section — with an `exact` flag on the
Dashboard so `/admin` does not claim every route.

The active treatment is **three signals at once**, because one is fragile: a left rail (position), a
tinted row (area), and a full-strength icon (colour). Colour alone would fail anyone who cannot
distinguish it.

## Icons, coloured by group

One hue per section — AI violet, Commerce emerald, Content amber, System slate, Dashboard sky —
carried as a `tone` field on the data rather than a class, so a page added later inherits its
group's colour for free.

Deliberately **not** brand tokens: `.admin-console` re-binds `--color-brand-*` to a single sky ramp,
so anything built on brand would render 23 identical blue icons, which is the problem being fixed.

Four hues you learn once beat 23 you never learn at all.

## There was no mobile navigation. At all.

The sidebar is `hidden lg:block` and nothing else rendered the nav, so below 1024px the entire admin
console had one text link and no way to reach any other screen. `AdminDrawer` is new capability, not
a restyle: all 23 links, closing on navigate and on Escape, with focus return and scroll lock.

### The bug that cost the most time

The drawer opened at **63px tall** — just its own header — with the nav links present in the DOM but
clipped to nothing.

The cause is subtle and worth writing down: the trigger sits inside the sticky admin header, which
carries `backdrop-blur`. **A `backdrop-filter` makes an element a containing block for
fixed-position descendants**, so the drawer's `fixed inset-0` resolved against the 64px header
instead of the viewport. Only measuring the real geometry found it — it renders, animates and
reports `visible`, so every functional assertion passed while the thing was unusable.

Fixed with `createPortal` to `document.body`, which is the right answer regardless: an overlay
belongs at the top of the stacking context, not nested inside whatever happened to trigger it.

## Also

- **Breadcrumbs** in the header, which previously held one mobile-only link and the user's name.
  Deliberately shallow — section, then leaf — since a full path would repeat the sidebar. Ids
  resolve to "Details" rather than costing a query per header render.
- **`next/font`** replaces three raw Google Fonts `<link>` tags that were render-blocking and
  re-shipped on every admin navigation.
- **`max-w-[1600px]`** on `<main>` — the panel's two- and three-column layouts stretched to
  unreadable line lengths on an ultrawide display.
- **Sign out gained an icon.** It was the one nav row without one, so its label sat an icon-width
  left of everything above it.

## Verified

| Check | Result |
|---|---|
| Exactly one link active, on 8 routes incl. nested | ✅ `/admin/personas/convert` → *Personas* |
| Breadcrumbs | ✅ `Personas › Convert` |
| Group hues resolve | ✅ four distinct, active at full strength |
| Sidebar hidden at 390px | ✅ |
| Drawer: 23 links, full height | ✅ 844px after the portal fix |
| Closes on navigate / Escape; scroll lock restores | ✅ |
| No client errors | ✅ |
