# Navigation — nested menus and dropdowns

## The gap

The site was **structurally incapable of a dropdown menu**. There was no `parent_id` anywhere in
`src/db/schema.ts`, and `header.tsx` selected one flat ordered list of `menu_items`. Every link was
top level, whatever the site's information architecture actually looked like.

## What changed

`menu_items` gains three columns:

| Column | Purpose |
|---|---|
| `parent_id` | self-reference, `ON DELETE CASCADE` |
| `icon` | curated key from `BLOCK_ICON_KEYS` — shown in the dropdown panel |
| `description` | one line under the label in the panel |

## One shared tree builder

`src/lib/navigation/tree.ts` is a plain module used by the header (server) **and** the footer, so
the two cannot drift apart on who sees what.

`buildMenuTree(rows, viewer)`:

1. Applies visibility **first** — `all` / `guest` / `auth` / `admin`, plus `isActive`.
2. Then nests what survives.

Two consequences worth stating, because both are behaviour someone would otherwise have to
rediscover:

- **An orphan is dropped, not promoted.** If a parent is hidden or deleted, its children do not
  reappear at the top level, where they would show up out of nowhere.
- **A parent whose children are all hidden stays a plain link**, not an empty dropdown.

## Depth cap

One level, like blocks. Enforced in `saveMenuItemAction`, not just in the form:

- an item cannot be its own parent
- the parent must itself be top level
- the parent must be in the same menu location
- an item that already has children cannot be moved under another

## The dropdown component

`NavDropdown` is **hand-written**. That matches `GridSelect` and `HelpTip` — this codebase has no
Radix or Headless UI, and one disclosure menu does not justify introducing one. (`@dnd-kit` was
added for the block builder because accessible drag-and-drop genuinely is hard; a menu is not.)

What it has to get right, and does:

| Behaviour | Why |
|---|---|
| Hover **and** click open it | Hover alone excludes touch users entirely |
| Escape closes and returns focus to the trigger | Otherwise focus is stranded in a closed panel |
| ArrowDown from the trigger opens and focuses the first item | The standard keyboard entry point |
| Arrows move within the panel; Home/End jump to the ends | |
| Outside click and focus leaving both close it | Tabbing out of the last item should behave like clicking away |
| A short close delay on mouse-out | A diagonal move from trigger to panel must not slam it shut |

## The footer

A footer item **with children** becomes its own column, heading and all. Items **without** children
stay together under "Company", which is what the footer did before nesting existed. So adding a
parent is opt-in — nothing rearranges on its own.

## What was verified

A real two-level menu built through the admin UI, then exercised on the live site:

| Check | Result |
|---|---|
| Dropdown trigger renders, closed by default | ✅ `aria-expanded="false"` |
| Opens on hover | ✅ |
| Children render with icons and descriptions | ✅ |
| Escape closes it | ✅ |
| Click opens, click again closes | ✅ |
| ArrowDown opens and focuses the first item | ✅ |
| Arrows move between items | ✅ |
| No client-side errors | ✅ |

Plus `scripts/verify-menu-tree.ts` — **13/13** — covering ordering by position, all four visibility
rules, inactive items, a hidden child not leaking through a visible parent, and both orphan cases
(missing parent, and parent hidden). Run via `npm run blocks:verify`.

## Still open

- The admin menu editor is a table with a parent dropdown, not drag-and-drop. It shows the hierarchy
  clearly but reordering is still the `position` number.
- The mobile menu does not render dropdowns yet — nested items are only in the desktop header and
  the footer.
