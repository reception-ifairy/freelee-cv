# Block Builder

Supersedes `docs/19-frontpage-sections.md`, which describes the system this replaced.

## What was wrong with the old editor

The frontpage editor worked, but it was a **list, not a builder**:

- Reordering was two arrow buttons, one server round-trip per nudge.
- Four of eight section types were editable, each with a hand-written form —
  `frontpage-forms.tsx`, 159 lines for four types. Adding a type meant writing another one.
- No layout control at all: no width, no columns, no background, no spacing.
- Only `custom_content` could appear more than once.
- It worked on the home page only, despite `page_sections.page` having been added as a generic
  column specifically so "a second page could reuse this later".

## Architecture

Three files, and the split between them is the whole design:

| File | Boundary | Holds |
|---|---|---|
| `src/lib/blocks/catalog.ts` | **plain module** | what blocks exist and what each one lets you edit |
| `src/lib/blocks/registry.ts` | `server-only` | rendering |
| `src/lib/blocks/layout.ts` | plain module | the shared grid system |

**Adding a block type is two edits**: an entry in the catalog, and a case in the registry. No admin
form, no route, no migration, no validation schema — the field declarations drive all of it.

The plain-module boundary is not a stylistic choice. `settings-schema.ts` documents what happens
when a shared schema is defined inside a `'use client'` file: the RSC bundler strips its value on
the server and the page crashes with "SETTINGS_SCHEMA[k] is not iterable". The opposite mistake —
importing `server-only` code into a client component — has broken the build **twice** on this
project (the AI provider registry, then the tools registry). The rule that works: *constants in one
file, implementations in another, joined on `key`*.

### Fields are data

```ts
fields: [
  { key: 'title', label: 'Heading', type: 'text', required: true, maxLength: 120 },
  {
    key: 'items', label: 'Features', type: 'repeater', itemLabel: 'Feature', min: 1, max: 12,
    fields: [
      { key: 'icon',  label: 'Icon',  type: 'icon' },
      { key: 'title', label: 'Title', type: 'text', required: true },
    ],
  },
],
```

Field types: `text` · `textarea` · `markdown` · `number` · `toggle` · `select` · `image` · `link` ·
`icon` · `repeater`.

`repeater` is what retired the bespoke forms — how-it-works steps, FAQ entries, testimonials, stats
and logo lists are all "a list of objects with the same sub-fields". Repeaters do not nest.

`select` renders through the existing `GridSelect`; every field can carry a `help` string rendered
by the existing `HelpTip`, which already has the slot for the instructional videos planned earlier.

The **same declarations validate on the server** (`validate.ts`). Two properties beyond type
checking:

1. **Unknown keys are dropped.** The saved config is rebuilt from the declared fields, never spread
   from the request, so a crafted payload cannot write arbitrary data into the jsonb column.
2. **Every string is bounded**, so one block cannot be used to write megabytes into a row.

### The grid system

`layout` is **its own column**, not part of each block's config. That is the point: layout is
uniform, so a block added in a year gets the whole system for free.

```ts
{ width, columns, background, paddingY, visibleOn }
```

Class names are looked up from maps, never built by concatenation — Tailwind only ships classes it
can see literally in the source, so an interpolated `py-${size}` would compile and produce no CSS.
`resolveLayout()` validates every value against its allowed set and falls back to the default, so a
hand-edited row renders instead of throwing.

**The eight blocks that predate the builder keep their own bands.** They render
`<section className="container-app py-N">` with asymmetric spacing (`pb-24`, `pb-6`, `py-16`), so
their catalog default is `full` width with no background and no padding — the wrapper becomes a bare
`<div class="w-full">` and changes nothing. That is what made the port provably safe. Newer blocks
render bare content and let the wrapper supply the band.

### Nesting is capped at one level

A `columns` container holds child blocks. A container cannot contain a container. The rule lives in
`canNest()` — a named pure function, not a condition buried in the action — so it can be tested
directly, and it is enforced in the server action, not merely hidden in the UI.

## The 17 block types

| Group | Blocks |
|---|---|
| Marketing | hero, how it works, call to action, feature grid, statistics, testimonials, logo wall |
| Content | text & image, FAQ, image & text, video |
| Live data | categories, featured personas, pricing, latest posts |
| Layout | spacer, columns |

Notes on two:

- **FAQ** is a native `<details>`/`<summary>` accordion — it opens, closes and is keyboard- and
  screen-reader-accessible with no JavaScript at all.
- **Video** URLs are **allow-listed** (YouTube and Vimeo only). The string becomes an `<iframe src>`,
  so passing arbitrary input through would let anyone with admin access embed anything, including a
  `javascript:` URL on an older browser. Anything unrecognised renders nothing rather than a broken
  frame.

## Drag and drop

`@dnd-kit` — the one place on this project a UI dependency earned its keep. Keyboard reordering
(Tab to the grip, Space to lift, arrows to move, Space to drop) and screen-reader announcements come
with it, and are genuinely hard to get right by hand. The up/down arrow buttons remain as a plain
no-JavaScript fallback.

The whole order saves in **one** request on drop, instead of one request per nudge.

## Scopes: home, pages, posts

The same table, components and actions serve all three, keyed by `BlockScope`:

| Scope | Rows |
|---|---|
| Home | `page = 'home'`, both owner columns null |
| CMS page | `page_id` set, `ON DELETE CASCADE` |
| Blog post | `post_id` set, `ON DELETE CASCADE` |

Real foreign keys rather than encoding the owner into the `page` text column — deleting a page must
not strand its blocks.

**The fallback is the important part.** Blocks take over only when the page is switched to the
builder **and** has at least one block. A page flipped over but not yet built keeps showing its
markdown, so the toggle can never leave a visitor looking at a blank page. `content` is never
touched, so switching back restores the original text exactly.

## Schema

`drizzle/0028_block_builder.sql`, additive, applied to the live database:

- `page_sections`: `layout`, `config_version`, `parent_id`, `page_id`, `post_id` + three indexes
- `menu_items`: `parent_id`, `icon`, `description` + index (see `docs/34-navigation.md`)
- `pages.use_builder`, `posts.use_builder`

`config_version` is the lazy-migration hatch: a block can change its config shape later and upgrade
old rows on read rather than needing a data migration.

## What was verified

Against the live site, not just typecheck:

| Check | Result |
|---|---|
| Home page after the port | **byte-identical** — same sha256, 3777px tall |
| Mouse drag reorders and persists | ✅ confirmed in Postgres after a hard reload |
| Keyboard drag reorders and persists | ✅ Tab → Space → arrows → Space |
| Repeater edit saves and reads back | ✅ icon preserved alongside the edited title |
| All 17 types offered in the picker | ✅ |
| Four new blocks added and rendered | ✅ |
| Container offers every block but itself | ✅ |
| Deleting a container cascades to children | ✅ |
| `canNest` rule | ✅ 8/8 — `scripts/verify-block-nesting.ts` |
| Video allow-list | ✅ 12/12 — including `javascript:`, `data:` and `youtube.com.evil.com` |
| Page fallback: markdown / builder-with-no-blocks / blocks / back | ✅ 601 chars, 601 identical, blocks, 601 again |

`npm run blocks:verify` runs the three script suites.

### Two bugs found by testing, not by reading

1. `revalidatePath('/admin/pages')` does **not** cover `/admin/pages/[id]/builder`. Builder routes
   are now revalidated explicitly.
2. `BlockList` held the server's rows in `useState`, which only reads its argument on mount. Adding
   a block wrote the row and revalidated the route while the list on screen never changed. It now
   resyncs when the server's data actually differs, compared by signature so it does not reset on
   every re-render. This affected the home page too — earlier tests missed it by navigating fresh
   each time instead of staying on the page.

## Still open

- Children of a container reorder with buttons only; the nested list has no drag-and-drop.
- No preview: you save and look at the live page. A side-by-side preview is the obvious next step.
- No revision history. `config_version` exists for shape migrations, not undo.
- The `image` field takes a URL; there is no picker wired to `storage/uploads` yet.
