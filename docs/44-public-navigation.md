# The public site: navigation and one theme

## The problem

Three separate things, all visible on the live site:

**1. A visitor and a paying customer saw an identical menu.** Every `menu_items` row was
`visibleTo: 'all'` — the mechanism to distinguish them had existed since the navigation work and was
never used. Those are opposite jobs. A visitor is deciding whether the product is for them and needs
the catalogue, the proof and the price. A member has already decided and needs their own
conversations; marketing copy in that nav is distance between them and what they came back for.

Research on marketplace UX is consistent here: **the catalogue is a logged-out experience.** Show
everything, and ask for a sign-in only when someone wants to go deeper.

**2. There was no mobile navigation at all.** The header's `<nav>` is `hidden lg:flex` and nothing
else rendered it, so below 1024px — most visitors — the site had a logo, a theme toggle and a button,
and no way to reach personas, pricing or the blog. The same gap the admin sidebar had.

**3. `/bionic` was a different product.** It used **zero brand tokens** — 100% hardcoded cyan and
purple on a fixed `bg-gray-950` — so the theme composer did not reach it at all. Pick any palette and
one page of the site ignored it. It also had `—` and `’` escapes rendering **literally** in
the copy.

## What visitors get

A four-section mega menu — Personas, Platform, Pricing, Resources — with columns of described links
and a promoted rail per panel.

Three things make it read as one menu rather than four:

- **A shared open state.** Moving from Personas to Platform swaps the panel rather than closing and
  reopening it, so it is one surface you move along.
- **Hover intent** — 80ms to open, 180ms to close. A diagonal move from a trigger to the panel below
  crosses a sliver of dead space; without the delay that slams it shut mid-gesture.
- **It is not hover-only.** Click and keyboard both work. Hover alone excludes touch and keyboard
  users from the entire navigation.

### Placeholders are shown, not linked

Voice, Crews, Guides, Changelog and Support are named with a `Soon` tag and **are not clickable**.
The shape of the product is visible before every part of it is built — but a nav link that goes
nowhere costs a click and a page load to discover the thing does not exist.

### A gated page is not advertised as browsable

`/marketplace` 307s to `/login`. It was in the first draft of the visitor nav as "Marketplace", which
would have spent a click to arrive at a sign-in form — the opposite of what a catalogue nav is for.
It now says "sign in to install" and points at `/register`.

**Every visitor nav destination was checked as a guest**: all 200, no redirects.

## What members get

Flat, with the current section marked — Chats, Personas, and Rooms/Crews when those modules are
enabled for the team. A member is going somewhere specific and a mega panel is friction dressed up
as richness.

`menu_items` still works: admin-added rows are appended as plain links, deduplicated against the
built-ins. Two nav systems would drift apart within a release.

## Mobile

Accordions, not a shrunk mega menu — a hover-driven three-column panel means nothing on a touch
screen, and reorganising for the smaller screen is the point of doing it properly. The two visitor
CTAs stay pinned to the bottom so they never scroll away behind an open section.

Portalled to `document.body`, for the reason the admin drawer had to be: the header carries
`backdrop-blur`, and **a `backdrop-filter` makes an element a containing block for fixed
descendants** — an overlay rendered inside it sizes itself to the 64px header.

## One theme across the frontend

New shared classes in `globals.css`, all built from `--color-brand-*` and neutral alpha rather than
fixed hues, so a palette change moves the whole frontend at once:

| Class | For |
|---|---|
| `.surface` | The default in-flow panel |
| `.surface-raised` | The one thing on a section that should come forward |
| `.surface-overlay` | Menus and popovers |
| `.hairline` | Separators that read on both grounds |
| `.eyebrow` | The small-caps label, previously hand-written at four different letter-spacings |
| `.focus-ring` | A focus style that is never removed |

**`.surface-overlay` exists because an overlay is not a raised surface.** The mega panel first used
`.surface-raised`, whose translucency reads as depth *in the page flow* — over the hero, the headline
showed straight through it. An overlay has arbitrary content behind it and needs a real ground.

### `/bionic` now follows the palette

Cyan → brand, purple → accent, and every `gray-*` ground swapped for a light/dark pair. The page
keeps its drama in dark mode and becomes a clean light page under a light theme, instead of being
black regardless.

That re-tune exposed the **`text-white` trap again**: "Explore the merge" is a gradient button whose
right half is now `brand-600`, which under Sovereign is near-white — so its white label became
invisible. Both filled buttons now use `text-on-brand`, the token added for exactly this in #35.
Verified by measuring: the label computes to `rgb(0,0,0)` on the light gradient.

## Verified

| Check | Result |
|---|---|
| Visitor triggers | ✅ Personas, Platform, Pricing, Resources |
| Panel swaps without closing | ✅ columns change in place |
| Placeholders non-clickable | ✅ `aria-disabled`, not anchors |
| Escape closes | ✅ |
| Every visitor destination as a guest | ✅ 7/7 return 200 |
| Member nav | ✅ Chats/Personas, no mega triggers, `/chat` marked current |
| Mobile drawer | ✅ accordions, pinned CTAs, closes on navigate |
| Bionic escapes | ✅ `—` gone, em dash renders |
| Bionic CTA contrast | ✅ black on the light gradient, was invisible white |
| All suites | ✅ 103 assertions + changelog |

## Not done

The mega panels are **static content, not DB-driven**. Wiring the Personas panel to real categories
and featured personas is the natural next step — the data is one query away — but it needs a caching
decision (the header renders on every page) that belongs with the work, not bolted on late.
