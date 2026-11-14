# 57 — Admin navigation: lists with a card on demand

**Owner decision, 2026-11-14.** The taxonomy, sectors and audiences should be browsed as lists, with a card opening only when wanted ("zamiast widoku kart system, który ułatwia przejrzyste przeglądanie, a karta otwiera się na życzenie"). This doc covers the building blocks every admin browser uses and the browsers built from them. Later updates add the sidebar by job and the homeschool hub, each as its own section here.

## Building blocks (freelee #78)

| Piece | File | What it is for |
|---|---|---|
| `useDialog` | `src/components/ui/use-dialog.ts` | One focus trap for every overlay |
| `Sheet` | `src/components/ui/sheet.tsx` | A panel from the right over a list: the card on demand |
| `RouteSheet` | `src/components/ui/route-sheet.tsx` | A Sheet whose open state is the URL (`?open=…`) |
| `Disclosure` | `src/components/ui/disclosure.tsx` | A section that folds |
| overlay root | `src/components/ui/overlay-root.ts`, `#admin-overlay-root` in `src/app/admin/layout.tsx` | Where admin overlays portal to |

### useDialog

What every overlay must get right, now in one place:
- focus moves to the panel on open, and Tab and Shift+Tab stay inside it;
- Escape closes it;
- the page behind does not scroll;
- on close, focus returns to whatever opened it, or to `returnFocus()`.

**Only the top overlay answers keys.** A Modal over a Sheet used to mean that one Escape closed both, because every overlay listened on `document`. The rule now lives in a small stack, `dialog-stack.ts`:
- only the most recently opened overlay reacts to keys;
- the page unlocks only when the last overlay closes, whatever order they close in.

Modal, Sheet and the phone nav drawer all use it.

**Two bugs this fixed:**
- **The drawer had no Tab trap.** Tab walked out into the page hidden behind it.
- **Modal never moved focus into itself.** In the render where `open` turns true, the panel is not in the DOM yet: `useMountTransition` mounts it one effect later. So callers pass `open && mounted`.

### Sheet and RouteSheet

`Sheet` is anchored to the right edge at full height. Its header stays put while the body scrolls, and the header holds Previous/Next and other `actions`. Below `sm` it takes the whole screen.

`RouteSheet` is for server pages:
- **Opening.** The page reads `?open=` and renders the card as the sheet's children. A row that opens a card is an ordinary `<Link scroll={false}>`, so Back closes the card.
- **Previous/Next** use `replace`, so stepping through 70 cards does not need 70 presses of Back to leave.
- **Closing** replaces the URL with `closeHref`.
- **Remembering it is closed.** "Closed" is remembered per `openId`: close A and click B before the server answers, and B still opens.
- **Focus after closing** goes to `returnFocusId`, the row of the card being closed, even after stepping with Next.

**Why the overlay root.** A portal to `<body>` leaves `.admin-console dark`, which loses the console's colour tokens, its mono face and every `dark:` style. Not portalling at all fails differently: any ancestor with `backdrop-filter` or `transform`, such as the sticky header, traps a `fixed` panel inside itself. `#admin-overlay-root` is an empty element at the end of the console, so both problems are avoided. The phone drawer moved there too.

### Disclosure

Built on native `<details>`/`<summary>`:
- it opens and closes before hydration;
- find-in-page (Ctrl+F) opens a folded section when the match is inside it;
- keyboard and screen-reader behaviour comes with the element.

**The animation** comes from `.disclosure::details-content` with `interpolate-size` in `globals.css`. A browser without these simply opens the section at once.

**`defaultOpen` only ever opens the section after the first render, never closes it.** A server page re-renders on every soft navigation. Passed straight to `<details open>`, the section opened for a card snapped shut as the card closed, taking with it the row that should get focus.

## Lists and tabs (freelee #79)

- **`ListConfig.keep`** (`src/lib/admin/list-query.ts`): URL params a list carries but its toolbar does not edit, such as a tree selection (`cat`, `sec`). Search, filters, "Clear all", sorting and paging keep them. See `docs/35-admin-lists.md`.
- **`sortToggle`**: a sortable column header and the direction it is sorted now.
- **`ResourceView`** (`src/components/admin/resource-view.tsx`) gains four options:
  - `sortHrefs`: clickable column headers with `aria-sort`, keyed by `meta[].key`;
  - `selectedId`: the row whose card is open, highlighted and marked `aria-current`;
  - `openInPlace`: the title link keeps the scroll position, covers the whole row, and carries `id="row-<id>"`, where RouteSheet returns focus; the ⋯ menu stays above it;
  - `toggle={false}`: a table-only list, without the grid/list switch.

  Existing lists are unchanged; every option defaults to the old behaviour.
- **`TabNav`** (`src/components/admin/tab-nav.tsx`): tabs as server-rendered links (`?tab=…`) with an optional count. The admin had tabs four ways. Links are the one that survives a reload, can be linked to, works before hydration, and runs only the open tab's queries. They are announced as links (`aria-current="page"`), not as the ARIA tab pattern, because each tab is another URL. The bot team page uses it ("Runs 3"). The category workspace and the homeschool hub will too.

Checked by `npm run admin:verify-list-query` (11 checks, part of `blocks:verify`).

## The taxonomy browser (freelee #80)

`/admin/taxonomy` used to be one long column of 20 category cards holding 103 sector tiles, each tile with three meters. It had no search and no filter, and a sector tile led to the sector's edit form rather than to the bots filed under it. It is now a browser.

**The tree** (`taxonomy-tree.tsx`, on the left from `lg`):
- **Nodes.** All categories › category › sector, each showing live/total bots, the risk level (R1–R3), and greyed out when switched off.
- **Filter box.** A category that matches by name shows all its sectors; one that matches only through its sectors shows just those, unfolded.
- **Folding.** Folding is client state. Arriving at a category by any route unfolds it, and nothing ever folds a category by itself.
- **Bots with no sector.** Bots in a category but under no sector show as "N without a sector". Bots with no category get their own node (`cat=none`).
- **Below `lg`.** The same tree sits in a Disclosure ("Browse: …") above the list.

**The list** (on the right): a header for the node, `TabNav` Personas | Sectors, `ListToolbar`, then a dense table-only `ResourceView` and `ListPagination`.
- **Personas list.**
  - Filters: live or not, audience type, curriculum tutors or not.
  - Sort: name either way, messages either way, newest.
  - Columns: category › sector (or the sector alone once a category is picked), audience, and badges (live, tutor, featured).
- **Sectors list.**
  - Filter: active or switched off.
  - Sort: catalogue order, name, number of bots.
  - Columns: category (at the top level only), bots live, risk.
- **The width budget.** At 1280px the table gets about 700px beside a 15rem tree. So `dense` caps the name at 14rem and other cells at 8.5rem, makes subtitles one line, and drops an empty badge column. Messages and suitability are kept off the table and stay in Sort and on the card. Measured at 1280px, 1600px and 390px, with no sideways page scroll.

**The card** is a RouteSheet at `open=persona-N` or `open=sector-N`. Previous/Next step through the rows on screen, never across a page.
- **Bot card.**
  - Shows: category › sector, audience type, model, version, price, use, dates, curriculum scope, description and expertise.
  - Audience groups link to their cards on Audiences. A group of another type is drawn dashed: stored, but never in the prompt (freelee #77).
- **Sector card.** Risk, narrative fit, interaction modes, suitability meters and description, with "Show its N bots".

**State** (`src/lib/taxonomy/browser.ts`, pure):
- **`parseBrowser`** reads `cat`, `sec`, `tab` and `open`:
  - unknown ids are dropped;
  - a sector brings its own category;
  - the Sectors tab exists only above sector level;
  - kept params are rewritten from what was understood.
- **`selectionHref`** builds tree and tab links:
  - search and filters stay while the list kind stays the same;
  - paging restarts and the card closes;
  - switching kind keeps only the search.
- **`withOpen`** opens or closes a card, keeping the list exactly as it was.

**Counts** (`treeCounts()`, `src/lib/taxonomy/browser-queries.ts`): one query with `GROUPING SETS ((category, sector), (category), ())` and `count(distinct)`, about 5 ms. The category is read through `persona_categories`. The sector's category always matches it (checked: 0 mismatches of 122 links).

Checked by `npm run taxonomy:verify-browser` (20 checks):
- the tree adds up;
- the URL is read safely;
- the links keep and drop the right params;
- Previous/Next stop at the ends.

**Verified live** (Playwright, 1280×900, 1600×1000 and 390×844; server render about 150 ms):
- **Top level:** "20 categories · 103 sectors · 87/123 bots live".
- **Education:** 16/32 with 6 sectors in the tree.
- **List state:** searching "tutor" keeps `cat` and finds 2; sorting by header keeps both.
- **Bot card:**
  - Next steps to the next bot;
  - Escape returns focus to the row of the card that was open;
  - 0 of 25 Tab presses left it.
- **Sectors tab and sector card:** "Show its bots" lands on the sector with 2 bots; Back reopens the card it came from.
- **Tree filter:** "nutri" leaves Lifestyle and Wellness › Nutrition Coaching.
- **Other views:** `cat=none` shows 1 bot; junk params fall back to the top level.
- **Phone:** the tree is folded and the page does not scroll sideways (the table scrolls inside its frame).
- No page errors.

## Markets (freelee #81)

**Owner decisions, 2026-11-14:** six markets ("pillars") based on the audience, not just Business and Homeschooling; and they are computed, not assigned. They live in `src/lib/taxonomy/pillars.ts`, with no migration.

| Market | Audience segments | Status | Page | Risk floor |
|---|---|---|---|---|
| Business | B2B-SIZE, B2B-SEC, B2B-FUN (except the three below) | sold now | /business | – |
| Homeschooling & family | B2C-CYP, B2C-GK, B2C-ADU-03 | sold now | /homeschooling | R2 |
| Schools & educators | B2G-PUB-01..04, B2B-SEC-01/02, B2B-FUN-01 | planned | – | R2 |
| Adults: life & career | the other B2C-ADU | planned | – | R1 |
| Interests | B2C-INT | planned | – | – |
| Public sector | B2G-CEN, B2G-LOC, B2G-PUB-05..10 | planned | – | R2 |

Every one of the 70 segments belongs to exactly one market (`pillarOfSegment`).

**A bot's market** (`pillarOfPersona`): the first rule that applies wins.
1. A curriculum tutor goes to Homeschooling & family.
2. Otherwise its first own segment of its own audience type decides.
3. Otherwise its category's first linked segment of that type decides.
4. Otherwise the default for its type: B2B → Business, B2G → Public sector, B2C → Adults.

Segments of another type never decide, just as they never reach the prompt (#77).

**A field's markets** (`pillarsOfCategory`) are those of its linked segments plus those of its bots. Education, for example, serves Homeschooling & family and Schools & educators.

**Computed in code, every time.** `botPillars()` in `pillar-queries.ts` reads every bot's type, segments and tutor scope, and every category's linked segments: two light queries over 123 bots. Past a few thousand bots, a generated column would be the next step.

**Screens:**
- **`/admin/markets`** shows the six markets with a share bar, each market's status, risk floor, live/total bots, fields, audience groups linked, and offering page. It shows coverage, not revenue.
- **`/admin/markets/[pillar]`** shows, for one market:
  - the fields serving it, with their bots there and whether they link the market's groups;
  - a warning when a field's risk is below the market's floor;
  - its audience groups, with how many fields link each and how many bots list it (own type only);
  - "Browse its bots".
- **The taxonomy browser** gets `?pillar=`:
  - market chips above the tree, each with its bot count;
  - within a market, the tree shows only the fields serving it, the counts and list only its bots, and the Sectors tab only those fields' sectors;
  - outside a market, a field shows a dot per market it serves.
- **Sidebar:** Markets heads the Taxonomy section until the sidebar is reorganised by job.

**Moved:** the audience family names are now `AUDIENCE_FAMILY_LABEL` and `familyOf` in `audience-segments.ts`, one place for Audiences and Markets.

**On live data (2026-11-14):**
- every bot falls in exactly one market (123 in all);
- **Business** 55 bots (47 live), 16 fields;
- **Homeschooling & family** 27 (13 live), Education only;
- **Schools & educators** 6;
- **Adults: life & career** 35;
- **Interests** 0;
- **Public sector** 0, though 2 fields link its groups.

Note that the 26 consumer bots in Education count as Homeschooling & family through rule 3. Education has linked family groups since #77, and those bots name no consumer group of their own.

Checked by `npm run taxonomy:verify-pillars` (15 checks):
- the 70 segments are partitioned and the per-market counts are right;
- the education exceptions go to Schools;
- each persona rule works, in order;
- a field's markets are its segments' plus its bots', each once.

The browser's market links are in `taxonomy:verify-browser` (now 24 checks).

## First use: the Audiences screen (freelee #78)

`/admin/taxonomy/audiences` used to be 70 expanded cards in one column. Now:
- **ten families that fold.** Each one-line summary lists the names in it and a count, so the whole catalogue fits on one screen.
- **One compact row per segment** inside a family: name, description, ages, sensitivity and code. The whole row is a link, and it is one tab stop.
- **The card opens in a sheet** at `?open=B2C-CYP-07`, with Previous/Next across all 70 and "3/70".

**The card also says where the segment is used** (`segmentUsage()`, `src/lib/taxonomy/segment-usage.ts`):
- which categories link the segment, with the operator's note;
- which personas list it, live ones first;
- how many of those personas never pass it to the model, because their own audience type differs (freelee #77).

The query runs only for the open card.

## Checks

`npm run admin:verify-dialogs` (`scripts/verify-dialog-stack.ts`, part of `blocks:verify`):
- the stack rules: a Modal over a Sheet, closing in either order, closing twice;
- that Modal, Sheet and the drawer use `useDialog` gated on being mounted;
- that the layout renders the overlay root outside the header;
- that Sheet and the drawer portal to the overlay root, not to `<body>`.

**Verified live with Playwright** (1440×900 and a 390×844 phone):
- the sheet renders inside the overlay root with the console's colours;
- focus is on the panel when it opens;
- 0 of 30 Tab presses left it;
- Next steps to the next segment;
- Escape closes it, returns focus to the row of the card that was open, and keeps its family open;
- Back closes it;
- a direct link opens it after hydration;
- a backdrop click closes it;
- the models Modal takes focus and gives it back to "Add manually";
- the drawer traps Tab (0 of 40) and returns focus to the menu button;
- on a phone the sheet is full width.
