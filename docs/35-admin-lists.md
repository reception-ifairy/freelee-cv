# Admin lists — grid, list, and the `⋯` menu

## What was wrong

Every admin list page was a full-width table: one wide bar per row, most of it empty on a large
screen, and each row ending in three to five **unlabelled icon buttons**. A bin, a star, a pair of
overlapping squares — each one a guess, and the bin fired on the first click with nothing to undo
it. Eleven pages had each hand-written their own version of this.

## What replaced it

One shared component set, and each page describes its items once:

| File | Role |
|---|---|
| `src/components/admin/resource-view.tsx` | grid and table rendering, plus the view toggle |
| `src/components/ui/action-menu.tsx` | the `⋯` menu |
| `src/components/admin/use-admin-action.ts` | calls a server action from a menu item |
| `src/lib/admin/view-preference.ts` | cookie name + type (**plain module**) |
| `src/lib/admin/view-preference-server.ts` | the `cookies()` read (`server-only`) |

A page builds a `ResourceItem[]` — title, subtitle, media, badges, meta fields, actions — and the
same description renders as either a card grid or a table. The two cannot drift apart, and a change
to either applies everywhere at once.

### Grid by default, list one click away

Both views are available on every list. The preference is remembered **per module**, so Sectors can
be a grid while Sales stays a table.

**Sales and Customers default to the list.** Those two exist to be compared with each other — a
card per order is far more scrolling for the same numbers. Everything else defaults to the grid,
which is a much better use of a wide screen: 103 sectors read as four columns instead of 103 bars.

### Why a cookie, not localStorage

The preference is a cookie so the **server** can read it while rendering. With localStorage the
server would always emit the grid and the client would swap to the list after hydrating — a visible
flash on every page load for anyone who prefers the table.

This is also where the boundary bit again: `view-preference.ts` is imported by
`resource-view.tsx`, a client component, so the `cookies()` call had to move to its own
`server-only` file. Putting them together failed the build with *"You're importing a module that
depends on next/headers"*. That is the **third** time this project has hit that wall — the AI
provider registry, the tools registry, now this. The fix is always the same: constants in one file,
server implementation in another.

### The `⋯` menu

Every action now has a **written label**. Destructive ones are separated by a rule and take two
clicks — the item changes to "Really delete?" before it fires. Actions that cannot apply are
disabled rather than hidden, so a row's options do not shift around (Refund is greyed on an unpaid
order, Delete is greyed on a locked page).

Hand-written, like `GridSelect`, `HelpTip` and `NavDropdown`. Keyboard support matches them: Escape
closes and restores focus to the trigger, ArrowDown from the trigger opens and focuses the first
item, arrows move, Home/End jump.

Because there is no longer a `<form>` per icon, actions are invoked directly through
`useAdminAction()` — server actions are callable from client components, and `startTransition` keeps
the page responsive while the revalidation lands.

## The block builder is the deliberate exception

`/admin/frontpage` and the page/post builders stay a **vertical list**, not a grid. In a builder the
order on screen *is* the order on the page; a grid would read left-to-right and wrap, which no
longer matches how the page stacks. The rows were compacted instead — roughly half the previous
height — and the five loose icon buttons became one `⋯` menu.

## Pages converted

`personas` · `categories` · `sectors` · `modifiers` · `packs` · `plans` · `passes` · `sales` ·
`customers` · `posts` · `pages` · `menus`

`settings`, `theme`, `translations`, `ai-models`, `knowledge-sources` and `marketplace` were left
alone — none of them is a list of like items, so neither view applies.

## A pre-existing bug this surfaced

`/admin/packs` was returning **500** and had been since the initial commit. The order count used a
correlated subquery:

```ts
sql`(select count(*) from ${orders} where ${orders.packId} = ${creditPacks.id})::int`
```

Drizzle rendered both sides unqualified — `where "pack_id" = "id"` — so Postgres bound `id` to
`orders.id` (text) rather than `credit_packs.id` (integer) and refused with *"operator does not
exist: integer = text"*. Replaced with a `LEFT JOIN` + `GROUP BY`, which cannot be mis-bound.

## What was verified

Every admin page loaded as an admin, with console and page errors captured:

| Check | Result |
|---|---|
| All 19 admin pages | ✅ 200, **zero** client errors |
| `/admin/packs` after the fix | ✅ 200 (was 500) |
| Grid is the default | ✅ |
| Switching to list works | ✅ |
| List **survives a reload** | ✅ — the cookie round-trip |
| Preference is per module | ✅ Categories list, Sectors still grid |
| `⋯` closed by default, opens on click | ✅ |
| Actions carry written labels | ✅ "Edit", "Delete" |
| Delete asks before firing | ✅ "Really delete?" |
| Escape closes the menu | ✅ |
| ArrowDown opens and focuses the first item | ✅ |
| Arrows move between items | ✅ |
| Nothing was actually deleted during the test | ✅ 20 categories before and after |

## Still open

- No sorting or filtering controls in either view beyond what a page already had.
- No bulk selection — actions are per item.
- The grid does not paginate; Sectors renders all 103 cards at once. Fine at this size, worth
  revisiting if any list grows into the thousands.

*(No module registry entry: this is a cross-cutting UI convention rather than a capability, so
inventing a module for it would make the registry less accurate, not more.)*
