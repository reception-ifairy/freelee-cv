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

- No bulk selection — actions are per item.

(Sorting, filtering and pagination were the other two entries here; they are the second half of this
page.)

*(No module registry entry: this is a cross-cutting UI convention rather than a capability, so
inventing a module for it would make the registry less accurate, not more.)*

---

# Search, filtering, sorting and pagination

Added after the grid landed, when it became obvious that a grid of 5,000 AI
cards is no more usable than a table of 5,000 rows.

## State lives in the URL

`?q=legal&status=featured&provider=google&sort=popular&page=2`

Not in React state. That single decision buys:

- a filtered view is a **link** — bookmarkable, shareable, survives a reload
- the **back button works**
- the **server** filters in SQL, so a list of 5,000 personas is never loaded
  into memory to display 24 of them

| File | Role |
|---|---|
| `src/lib/admin/list-query.ts` | parse/serialise params, page maths (**plain module**) |
| `src/components/admin/list-toolbar.tsx` | search, filter dropdowns, sort, page size (client) |
| `src/components/admin/list-pagination.tsx` | page links (**server**-rendered) |

A page declares a `ListConfig` — its filters and its sorts — and everything else
follows. Filter options are data, so the Provider filter is built from the AI
registry rather than a hardcoded list: add a provider and it appears here with
no further edit.

## Details that matter

**Every control resets to page 1.** Narrowing 300 results to 12 while sitting on
page 7 shows an empty list, which reads as "no results" when it means "no page
7".

**Search is debounced (300ms) and uses `replace`, not `push`.** A five-letter
word is one request, not five, and typing does not bury the back button under a
keystroke-per-entry history.

**The URL is the source of truth for the search box too.** "Clear all" and
browser-back both update the input rather than being overwritten by stale local
state.

**Unknown filter values are dropped at parse time.** A hand-edited
`?status=nonsense` narrows nothing instead of reaching SQL as junk — verified,
it returns the full unfiltered list.

**The count uses the same conditions as the page query**, so "21 results" always
matches what paging all the way through would actually give you.

**Category filtering uses `EXISTS`, not a join.** A persona in three categories
must appear once; a join would return it three times and break both the count
and the page size.

**Pagination is plain server-rendered links.** Paging works with JavaScript off,
each page is a real URL, and the browser prefetches on hover for free. A
disabled arrow is a `<span>`, not a dead anchor that is still focusable and
still announced as a link.

## Verified against 150 seeded personas

Seeded across ten expertises, five providers, three audiences and mixed
published/featured/premium states, then removed. Every count checked against
SQL, not eyeballed:

| Query | UI | SQL |
|---|---|---|
| no filters | 151 | 151 |
| search "Legal" | 15 | 15 |
| status=draft | 37 | 37 |
| status=featured | 21 | 21 |
| status=premium | 13 | 13 |
| provider=google | 30 | 30 |
| audience=B2G | 50 | 50 |
| google **and** published | 23 | 23 |
| `?status=nonsense` | 151 (rejected) | — |

Plus: page 1 and page 2 share **zero** items; the last page of 151 at 24/page
holds exactly 7; `per=96` returns 96 cards; `sort=name` is genuinely A–Z;
`sort=popular` leads with the highest message count. Sectors: 103 → 10 for
"Marketing", matching SQL, and `sort=b2g` leads with Compliance Management.

## A second silent bug, same root cause as packs

`/admin/customers` reported **0 chats for every customer**. Same unqualified
correlated subquery as the packs 500:

```ts
sql`(select count(*) from ${chats} where ${chats.userId} = ${users.id})::int`
```

Rendered as `where "user_id" = "id"`, binding `id` to `chats.id` instead of
`users.id`. Here both columns are text, so Postgres did **not** error — it just
quietly returned the wrong number, which is worse. Platform Admin has 6 chats
and the page said 0. Replaced with a `LEFT JOIN` + `GROUP BY`; now shows 6.

A grep confirms these were the only two instances in the codebase.

## Applied to

`personas` (search · category · status · provider · audience · 4 sorts) ·
`sectors` (search · category · status · 5 sorts) ·
`customers` (search by name or email · status · 3 sorts)

The remaining lists are small, fixed configuration sets — 20 categories, a
handful of plans — where a toolbar would be noise. Adding it to one is a
`ListConfig` plus three lines.

## Still open

- Search is `ILIKE '%term%'`, which cannot use a normal index. Fine into the low
  tens of thousands; a trigram index (`pg_trgm`) is the fix if it ever matters.
- No saved views or multi-select filters — one value per filter.
- Deep pagination uses `OFFSET`, which slows down on very large tables. Keyset
  pagination is the answer if any list reaches that size.

