# 57 — Admin navigation: lists with a card on demand

**Owner decision, 2026-11-14.** The taxonomy, sectors and audiences should be browsed as lists, with a card opening only when wanted ("zamiast widoku kart system, który ułatwia przejrzyste przeglądanie, a karta otwiera się na życzenie"). This doc covers the building blocks every admin browser uses and the screens built from them: the browsers, the markets, the homeschool hub, the sidebar, the dashboard and the connections page.

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

## Markets (freelee #81) — retired in #88

> **Retired on 2026-11-16 (#88).** The owner decided the taxonomy's categories are the pillars; the six computed markets, their pages, the `?pillar=` filter and the market dots are gone. The section stays as the record of what was built and why it was removed.

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

## A field's workspace (freelee #82) — folded into the browser in #88

`/admin/taxonomy/[id]` used to be one long page, with the workbench, sector tiles, the audience picker and three fact cards stacked on top of each other. It is now a workspace with three tabs (`?tab=`, via `TabNav`):
- **Overview:**
  - **Bots:** live/total, split by the markets of this field's bots, with a link into the browser at this field.
  - **Specialisms:** each with live/total and risk, each a link to that sector in the browser, plus the bots with no sector.
  - **Who it serves:** the audience groups as text.
  - On the right, as before: the market card, the field's lean, and what the slug decides.
- **Audiences** (`audiences-tab.tsx`):
  - the linked groups by kind, each with its market;
  - the first of each kind marked **decides**: rule 3 of a bot's market (`pillars.ts`) takes it;
  - a note you can edit in place.

  "Choose audiences" opens the 70 groups, folded by family, with search and a market dot on each. Existing picks keep their position and new ones go after them in catalogue order, so saving never changes which group decides.
- **AI workbench:** the design workbench. The field's AI steward (a later plan) moves in here.

**A departure from the plan:** there are no Sectors or Bots tabs. The taxonomy browser already lists a field's sectors and bots with a card on demand, and a second copy is how a maze starts. So Overview summarises them and links into the browser.

**`setCategoryAudienceNoteAction`** (`src/server/actions/admin-taxonomy.ts`) writes `category_audience_segments.note`. Notes are trimmed, at most 500 characters, and an empty note clears it. Until now only a migration could write one.

**Ties in position:** five of Education's links share position 0. `categoryBrief` and `categorySegments` now both order by (position, code), so the brief's first group and the market rule's first group are always the same one.

**Verified live** on Education (1280 and 390px):
- **Header and Overview:** 16/32 live, R2, serving Homeschooling & family and Schools & educators. Overview shows Family 13/26 and Schools 3/6, and its 6 sectors link to the browser.
- **Audiences tab:** 12 consumer, 2 business and 3 public groups. **decides** marks Home Educated, Education (Private) and State Schools (Maintained).
- **Editing a note:**
  - the textarea takes focus;
  - Save writes to the database;
  - Escape cancels without saving.

  The original notes were backed up first and restored, with 0 differences.
- **Choose audiences:** searching "SEND" finds SEND Learners, and Save stays disabled until something changes.
- **AI tab and phone:** the AI tab renders the workbench (no message sent). On a phone the page does not scroll sideways.
- No page errors.

## The homeschool hub (freelee #83) — moved to Education and Training in #88

The owner said "homeschooling is starting to look like a maze": its tutors, its curriculum and its families had no place in the admin, and the curriculum connection sat three levels down in Settings. `/admin/markets/homeschooling` is now the hub, with four tabs (`?tab=`, each reading only its own data):
- **Overview:** the market page every market has (fields, audience groups, risk floor).
- **Tutors** (`hubTutors()`, `src/lib/curriculum/hub-queries.ts`): every persona whose current version has a curriculum scope, live ones first, with key stages, subjects, messages and status. Each links to its card in the browser and to its editor.
- **Curriculum:**
  - **What freelee holds:**
    - the connection: key saved, last test;
    - the subject dictionary: version, Fetch date, subjects and parts;
    - the exams: count, checked at source, by family;
    - the scope: objectives per key stage.

    It links to the connection card in Settings rather than repeating it; every key keeps one home.
  - **The coverage grid** (`src/lib/curriculum/coverage.ts`, pure): each subject a parent can choose × KS1–KS4, with live/all tutors who would teach it. A tutor counts by the rule lessons already use: the key stage is in its scope, and `sameFamily` matches the subject (the same subject, or a part of the same whole, so a science tutor counts for biology). Cells outside a subject's years (the dictionary's `from`/`to`) are not offered and never count as gaps.
- **Families** (`familyCounts()`, `src/lib/children/admin-counts.ts`): numbers only (docs/54).

**A banner on every hub tab** compares the public page's promise with live tutors:
- while none is live, it says the published /homeschooling says "in preparation" (#77) and should stay so;
- once one is live, it reminds the owner to change that copy.

Other markets ignore `?tab=`.

Checked by `npm run children:verify-tutor-coverage` (14 checks):
- the grid rules (synonyms, scope key stages, one whole, live versus all, years, the summary);
- static checks that the family counts never name `data` or `wrappedKey`, never select whole rows, import nothing that can decrypt, and only aggregate.

**Verified live (2026-11-14):**
- all four tabs return 200;
- the banner says no tutor is live;
- Tutors lists the Baseline Tutor (KS1–KS4, not live);
- **Curriculum:**
  - the key works, tested 2 days ago;
  - 27 subjects, 9 of them parts;
  - 74 exams, 57 checked;
  - 1,452 objectives;
  - the grid has 26 subjects, and 0 of 87 offered cells have a live tutor (28 have any);
- Families shows zeros (there are no profiles);
- Business ignores `?tab=families`;
- on a phone the page does not scroll sideways;
- no page errors.

## The sidebar by job (freelee #84)

The sidebar was grouped by technical layer (AI, Taxonomy, Knowledge, Teamwork, Commerce, Content, System), never folded, and held 29 links. Translations and Branding sat under System, beside keys and settings. It is now grouped by job (`ADMIN_NAV`, `src/lib/admin/nav.ts`):

| Group | Items |
|---|---|
| (top) | Dashboard |
| Markets | All markets, then the six markets, each with its colour dot. Planned markets are dimmed |
| Catalogue | Personas, Taxonomy (was "Categories"), Audiences, Drafts, Prompt modifiers |
| Knowledge | Library, Shelves, External sources |
| Teamwork | Bot teams, Rooms, Projects |
| Commerce | Credit packs, Subscription plans, Access passes, Sales, Customers, Marketplace, Leads |
| Site | Frontpage, Pages, Showcase, Blog, Menus, Translations, Branding |
| System | Settings, Handbook, Documentation |

**Groups fold.**
- **Remembered:** the open groups are kept in the `admin_nav_open` cookie (path `/admin`). The layout reads it on the server (`parseOpenGroups`), so the sidebar arrives already folded the way it was left, with no flash.
- **Defaults:** with no cookie, Markets and Catalogue are open. An empty cookie means everything is folded.
- **Always open:** the group of the current page (`groupOfPath`). Its heading is disabled and shows no chevron.
- **Folded Markets** still shows the six colour dots.

At 1280×900 the whole sidebar fits without scrolling, with 13 links visible by default.

**The breadcrumb names what it shows.**
- **Real names:** a detail page renders `<BreadcrumbName name={…} />` (`breadcrumb-name.tsx`, a context in the layout), and the header's last crumb becomes that name instead of "Details". The page already has the name, so the header costs no query.
- **Where:** 11 detail pages use it — the persona, field workspace, category and sector editors, credit pack, bot team, run, library document, customer, project and room.
- **Before hydration** the crumb still reads "Details" for a moment.

**Handbook paths** follow the new groups ("Admin → Catalogue → Taxonomy", "Admin → Knowledge → Library", "Admin → System → Settings → Email").

`npm run admin:verify-nav` (now 12 checks) adds:
- route patterns for segments that are not numbers (`/admin/markets/business` is a page);
- unique group ids;
- the cookie rules;
- every page belonging to a group, with known paths landing in the right one;
- each market having its own item and colour.

**Verified live** (Playwright, 1280 and 390px):
- **Defaults:** Markets and Catalogue open, with 13 links visible.
- **Remembered:** folding Markets and opening Commerce writes `catalogue,commerce`, and a reload renders exactly that from the server. Folded Markets shows its 6 dots.
- **Always open:** on Translations, Site stays open and its heading is disabled.
- **Breadcrumbs:** "Taxonomy › Education and Training", "Taxonomy › Categories › Education and Training", "Personas › AmaterAI" and "Homeschooling & family".
- **Phone:** the drawer shows the same groups.
- No page errors.

## The dashboard's attention list (freelee #85)

The dashboard showed platform totals and one banner for pending orders. With about 20 messages and no orders a month, the totals said little, and what needed doing was spread over a dozen screens. It now opens with two panels.

**Needs your attention** (`src/lib/admin/attention.ts`, pure: facts → items):
- **Act** — someone is waiting or something is broken:
  - orders awaiting payment;
  - new leads;
  - marketplace listings to review;
  - connections whose last test failed.
- **Check:**
  - no live tutor while /homeschooling is published;
  - fields below the risk floor of a market they serve;
  - connections saved but never tested.

  Built-in default addresses are excluded from "never tested".
- **Tidy:**
  - visible fields with no bot;
  - visible fields with no audience;
  - bots holding audience groups of another type. These are stored but never in the prompt (#77), and the item links to the browser filtered to them (`?groups=other-type`, a new persona filter).

Each row links to where the thing is done. The old pending-orders banner became the first item.

**Markets:** the share bar and live/total bots per market, each linking to the market's page.

**Header badge "N to act on"** (`attention-badge.tsx`) appears on every admin page when an Act item exists, and links to the list. It reads only the light facts, about 10 ms. A failure there renders nothing rather than breaking the page.

**Facts** (`attention-queries.ts`):
- the counts come from one query of scalar subqueries;
- connections come from settings already read for the request;
- the risk-floor check reuses the dashboard's `marketSummaries()` (about 140 ms cold).

A segment of another type is detected by its prefix (`left(code, 3)` against the bot's audience type), because every code starts with its type.

Checked by `npm run admin:verify-attention` (10 checks):
- an empty state;
- the order act → check → tidy;
- the badge counts only Act items;
- the wording;
- the tutor rule depends on the page;
- one risk-floor item per market, and none for the header;
- the links.

**Verified live:**
- the 8 items today: 0 act, 5 check, 3 tidy;
- no badge;
- the Markets card matches the Markets page;
- the other-type link opens the browser with 55 bots;
- a test lead turned the badge to "1 to act on" on the dashboard and on another page, and put "1 new lead" first. The lead was then deleted, and 0 test leads remain.

## Connections and a tidy Settings (freelee #86)

**Before.** The 13 connection cards (Save → Test → Fetch, docs/51) were spread over four settings sections:
- Providers & keys held 9 of them, plus 23 schema keys in one long form;
- Billing, Email and Media storage each held a card and little else.

"Is everything connected?" took four screens.

**`/admin/connections`** (System → Connections) holds all 13 now:
- **in groups** (`src/lib/admin/connection-groups.ts`): AI providers, Tools for bots, Knowledge, Email, Payments, Storage;
- **with a summary at the top** that marks each connection Working, Failing, Never tested or Not set up, and jumps to its card;
- **with an anchor on every card** (`#conn-<id>`), so links land on it. The homeschool hub, the persona form's curriculum hint and the attention list link straight to their card.

**Settings keeps only values**, each in one section (`SECTION_FIELDS`, `src/lib/admin/settings-sections.ts`):

| Section | Keys |
|---|---|
| AI defaults | the default model per provider, the fallback provider |
| **Safety** (new) | moderation mode, blocked words |
| Billing | bank transfer, invoice vendor, and **free use** (free messages before signup, credits at signup) |
| Email | the From address only |

- **Free use moved to Billing** because what a visitor gets for nothing is a pricing decision. Its keys stay in the `ai` schema group, and the form still posts `__group=ai`.
- **Media storage is gone from Settings.** It was only a connection card.
- **Old links redirect** (`MOVED_SECTIONS`): `?section=storage` lands on the S3 card.

`AiDefaultsForm` takes the section's `keys` and shows only the cards whose keys it holds. The save action stores only the fields it receives, so splitting the form loses nothing.

**Text and links** that said "Providers & keys" now point to Connections. That covers the persona form hint, the provider and embedding cards, the Knowledgebase error message, the workbench tooltip and the handbook.

`npm run admin:verify-settings-map` (8 checks, react-server condition; no network or database use):
- all 13 connections sit in exactly one group;
- each of the 39 schema keys has exactly one home, either a section or a connection (`connectionSettingKeys`, which includes ElevenLabs' chosen voice);
- every key a section or connection names exists in the schema;
- every form section declares its fields;
- a moved section redirects.

## Categories are the pillars (freelee #88)

**Owner decision, 2026-11-16:** the twenty taxonomy categories are the platform's pillars. Homeschooling belongs to *Education and Training*, the business offer to *Business and Finance*. The six markets computed from audiences (#81) were removed: `pillars.ts`, `pillar-queries.ts`, `/admin/markets`, the `?pillar=` filter, the market dots in the tree and on audience groups, the "decides" marker, the Markets card and the risk-floor items in the attention list. The 70 audience segments stay; nothing is computed from them any more.

**The sidebar's first group is Categories** (`categoryNavSection`, `src/lib/admin/nav.ts`). It is built at request time: the layout reads the categories with their live/total bots (`treeInputs` + `treeCounts`, the tree's own two queries) and passes them to `AdminNav` and the phone drawer. Each item has the category's colour and `live/total`; a category with no bot is dimmed. An item opens `/admin/taxonomy?cat=<id>` and is current there (`isCategoryItemCurrent`, by id or slug, via `useSearchParams`); while it is, the Taxonomy item is not also marked. Folded, the group shows the dots of categories that have bots. `DEFAULT_OPEN_GROUPS` is Categories and Catalogue.

**A category is a view of the taxonomy browser, not a separate page.** The tree stays on the left. `browser.ts` gains category tabs:
- lists: `personas` (labelled Bots) and `sectors`;
- a picked category (no sector): `audiences`, `agent` (the workbench, the future AI agent), `brief` (the market facts, `category-brief.tsx`);
- the category with the homeschool hub: `tutors`, `curriculum`, `families` (`homeschool.tsx`, moved unchanged; families stay numbers only).

`validTab` keeps a tab only where it means something, so a hand-edited URL falls back to the bot list. `cat` also takes a slug (`?cat=education-and-training`), so links survive a database move; the kept params are rewritten to the id. Moving to another category keeps the tab.

**What a category carries beyond the taxonomy** is in `src/lib/taxonomy/category-extras.ts`, by slug: `education-and-training` has the offering page `/homeschooling` and the hub; `business-and-finance` has `/business`. The header links the offering page.

**Redirects.** `/admin/taxonomy/[id]?tab=` → `/admin/taxonomy?cat=<id>&tab=` (`overview`→`brief`, `ai`→`agent`). `/admin/markets` → the taxonomy; `/admin/markets/homeschooling[?tab=tutors|curriculum|families]` → Education with that tab; `/business` market → Business and Finance; the other four → the taxonomy. `NAV_ADOPTIONS` keeps the redirect pages under Taxonomy.

**The dashboard** shows a Categories card (live/total per category, busiest first, linking into the browser) where the Markets card was.

**Width.** With eight tabs beside the 15rem tree, `TabNav` padding went from `px-4` to `px-3`, and the category tabs carry no counts (the header says them). Measured at 1280px: 696 of 696px.

Checks: `admin:verify-nav` (the category items, current by id or slug, the retired markets under Taxonomy), `taxonomy:verify-browser` (slug, category tabs, hub tabs only where the hub is), `admin:verify-attention`. `taxonomy:verify-pillars` is gone with the pillars.

## The category agent (freelee #89)

**Owner decisions, 2026-11-16:** each main category has an AI agent on Anthropic that helps build bots for it; it **proposes, the owner approves**; model **Claude Opus 5.5**.

- **Where:** the category's *AI agent* tab (`workbench.tsx`, the old workbench rebuilt). One thread per category, the `playground` conversation keyed by `settings.categoryId`, opened on first use.
- **Model:** always Anthropic; `category_agent_model` (Settings → AI defaults, `SECTION_FIELDS.ai`), default `claude-opus-5-5`. `categoryAgentModel()` (`src/lib/taxonomy/category-agent.ts`) also says whether a key exists (Connections or `ANTHROPIC_API_KEY`). Without one, the tab says so and links Connections; no thread is created and nothing falls back to another provider (the route answers 503).
- **What it knows** (`agentContext`): the researched brief (`briefForModel`), every bot filed in the category (live or not, kind, sector, tagline), sectors with their ids and bot counts, the sectors with none, the linked audience codes; on the hub category, the tutors and the subject × key stage gaps (`coverageGrid`).
- **One tool, `propose`** (`agent-proposals.ts`): kinds `bot` (a full persona, validated with `convertedPersonaSchema`), `sector_description` (one of the field's sectors, 20–800 characters), `audiences` (known codes, already-linked ones dropped, with a note). The input is one flat schema checked per kind; an invalid proposal returns an error the model fixes. A checked proposal is appended to the thread's `settings.proposals` under a row lock (`updateThread`); nothing in the catalogue changes.
- **Approve / Reject** (`decideProposalAction`): a bot goes through `createDraftPersona` — the same function as the pasted-JSON path, now shared — so it is always an inactive draft with its own-kind audiences and mandatory safeguards; a sector description updates that sector (only within the category); audience groups are appended after the existing ones with the agent's note. Every decision is recorded on the proposal (`decide`: a decided proposal cannot be decided again).
- **Opus 5.5 specifics:** no `temperature` or forced tool choice (both rejected); thinking is always on at the default effort (medium); `maxOutputTokens` 16000; at most 4 steps. The system prompt (brief + bot list) carries `cacheControl: ephemeral`, so replies after the first read it from cache.
- **Cost on screen:** each reply's token usage (uncached, cache read, cache write, output from `totalUsage.inputTokenDetails`) is added to `settings.usage`; `estimateUsd` (`agent-pricing.ts`) prices it at list prices — Opus 5.5 $4 / $20 per million, cache reads $0.20, writes 1.25× input. The header shows the model, its price and the conversation's total.
- **The pasted-JSON path** stays under *Paste a persona by hand*.

Checked by `npm run taxonomy:verify-agent` (17 checks, react-server condition, no model or network): prices, every proposal rule, decisions, and static checks on the route (Anthropic only, no sampling parameters or forced tool choice, the cached system prompt, one tool with a step limit, the 503 without a key). `admin:verify-settings-map` covers the new setting's single home.

**Not verified live:** no Anthropic key is configured, so no reply has been generated yet. Verified live: the tab, the no-key message and link, the setting in AI defaults, the route refusing a request with no thread (404), no thread created without a key.

## Every list in the taxonomy's layout: Catalogue (freelee #90)

**Owner decision, 2026-11-16:** "the taxonomy view is very good — let it be the model for the whole admin dashboard; the left rail is functional." All lists move to it, section by section; #90 is Catalogue.

**One list of bots.** The taxonomy browser *is* the bots list:
- `/admin/personas` redirects to `/admin/taxonomy`, keeping what the browser can filter by: `q`, `status` (`published` → `live`, `draft` → `draft`), `audience`, `category` → `cat`, `sort` (`name`, `newest`, `popular`). Featured, premium and provider have no browser filter (today 0 featured, 0 premium); the card shows them. The old grid (`personas-list.tsx`) is gone.
- The bot's card carries what the grid's ⋯ menu did (`persona-card-actions.tsx`): Publish/Unpublish, Mark as featured, Duplicate, Delete (confirmed; closes the card). The persona actions now revalidate the whole admin layout, so the browser and the sidebar's live/total update.
- The browser's header has **Category**, **Sector**, **Convert a bot** and **New bot**.
- `NAV_ADOPTIONS` puts `/admin/personas/*` (editor, New, converter) under *Bots & taxonomy*; their back links point there.

**Drafts is a filter, not a page.** `/admin/taxonomy/drafts` (and the older `/prototypes`) redirect to `/admin/taxonomy?status=draft`; `listPrototypes()` is gone. The sidebar item's href carries the query, so nav matching learned queries: `isNavItemCurrentAt(item, pathname, search)` makes an item with a query current only on its path *with* that query, and then it wins over the plain item at the same path (Drafts over Bots & taxonomy). `hrefPath()` strips the query wherever an href is checked against a route.

**Catalogue menu:** Bots & taxonomy, Audiences, Drafts, Prompt modifiers.

**The generic browser mode** (`ResourceView browser`, `src/components/admin/resource-view.tsx`) — so the other ~15 lists need no per-list code:
- a left rail: by default the rows grouped by their **first badge** (on nearly every list the status) with counts and *All*, as `?group=`; or `groupBy` for another grouping; or `rail` — links the page owns (another query, its own counts);
- a dense table (`openInPlace`, the open row highlighted); a row opens its card at `?open=<id>` in a `Sheet`, with 3/24 and Previous/Next across the visible rows; Esc or close drops `open` and puts focus back on the row;
- the card is built from the `ResourceItem` the list already makes: badges, every `meta` field as a definition list, the actions as buttons (danger ones confirmed), and **Open** for the item's own page when it has one;
- `meta[].cardOnly` keeps a long text (a modifier's instruction) off the table and on the card;
- `before` puts a form or a note above the table.

**Prompt modifiers** are the first list on it: the five types as the rail (with counts), the *New … modifier* form in a fold above the table, the full instruction on the card. The grid/list toggle is gone from this list.

Checks: `admin:verify-nav` — sidebar and registry hrefs are pages once the query is stripped; Drafts is current with `status=draft` and Bots & taxonomy then is not; `/admin/personas/*` belong to Bots & taxonomy; the old Drafts and Prototypes addresses still exist.

**Verified live** (1280, 1600, 390): the redirects with their filters; Drafts current in the sidebar; the four header buttons; a draft's card with its four actions — *Mark as featured* then *Remove from featured* updated the card both times (0 featured afterwards); modifiers: rail counts 5/5/5/3/0, card at `?open=1`, Next → `open=2`, Esc → closed, no horizontal scroll, no page errors.

## Commerce in the taxonomy's layout (freelee #91)

All seven Commerce lists use the browser mode from #90:

| List | Rail | Notes |
|---|---|---|
| Credit packs | Active / Off (rows) | Card: fields, Delete; **Open** is the pack editor |
| Subscription plans, Access passes | Active / Off (rows) | The create form folds above the list (`FormFold`, open while the list is empty) |
| Sales | Pending / Paid / Failed / Refunded / Cancelled (rows, latest 100) | Stats stay above; card: Mark as paid, View customer, Refund |
| Customers | All / Active / Suspended / Admins — **counted in SQL** within the search, links set `?status=` | Paged, so counting rows on screen would be wrong; toolbar above, pagination below |
| Marketplace | Pending review / Live / Suspended / Rejected / Draft (rows) | Now lists **every** listing (it showed only pending and live, so a rejected or suspended one could not be found); card: Approve, Reject, Suspend; payouts fold above |
| Leads | Waiting / Contacted / Closed (rows, latest 200) | The waiting banner stays above |

What the browser mode gained for them:
- `groups` — statuses always in the rail, in order, at 0 too (a status nobody is in yet is still a place to look);
- `after` — under the table (pagination);
- a card action that only opens the item's own page is dropped, because the footer's **Open** is it;
- `InlineForm bare` (no card, no heading) for use inside `FormFold` (`src/components/admin/form-fold.tsx`), which modifiers now use too.

The grid/list toggle is gone from these lists; `view` cookies for them are no longer read.

**Verified live** (1280, 1600, 390): all seven pages answer 200 with their rails; packs 3/3/0 and the pack card (Delete, Open); customers 2/2/0/1, `?status=admin` marks Admins with 1 row, the customer card (Suspend account, Open); plans, passes, sales, marketplace and leads are empty on this site, so only their empty states, folds and rails were seen; no horizontal scroll, no page errors. **Not verified:** a card with real orders, leads or listings, and their actions — there are none yet.

## Site, Knowledge and Teamwork in the taxonomy's layout (freelee #92)

The last sections move to the browser layout:

| List | Rail | Notes |
|---|---|---|
| Pages | Published / Draft | Form folded above; card: View on the site, Delete; Open = editor |
| Blog | Published / Scheduled / Draft | Same |
| Showcase | Live / Hidden | Move up/down on the card; *Promote real work* stays under the list |
| Menus | Header / Footer / Legal (links, with counts) | Replaces the segmented tabs, as modifiers' types did |
| Shelves | On / Off | New `shelves-list.tsx`; the address (`key`) is on the card only |
| External sources | Active / Off (+ *No key*) | New `sources-list.tsx`; the card's body is the whole `SourceCard` editor (`ResourceItem.detail`), so the stack of open editors is gone |
| Bot teams | How they work (the first badge) | Card: Test run, switch on/off; Open = the team |
| Rooms | Room / Playground | New `rooms-list.tsx`; the card shows the same facts the list did — team, participants, cost, messages, last message — never what was said; Open reads the room |
| Projects | Active / Paused / Done / Archived | Form folded above |

**The Library** keeps its own component, because it selects many books at once for processing: `shelf.tsx` gets the rail — *Status* (Everything / Not processed / Ready / Needs attention, counted over every document) and *Folders* (counted within the status picked; *Every folder*) — instead of the segmented control. Rows stay as they were, with checkboxes, *select all* per folder, and the title linking to the document's page.

**Shared pieces:**
- `RailItem` (`src/components/admin/rail-item.tsx`) — one rail line, a link or a button, styled as the taxonomy tree's lines; `ResourceBrowser` and the Library use it;
- `ResourceItem.detail` — the card's own body in browser mode (an editor, a test).

With #90–#92 every list in the sidebar is in the browser layout. Not converted: the Dashboard, Frontpage (the block builder), Translations, Branding (the theme composer), Audiences (already a browser by family, #78) and Settings (#93).

**Verified live** (1280, 1600, 390): all nine pages answer 200 with their rails and counts — pages 5/5/0, posts 3/3/0/0, menus 7/5/0, shelves 3/3/0, bot teams 2; the cards of a page, a post, a footer link, a shelf and a bot team; the Library's rail (132 · 0 · 132 · 0; folders 4 / 14 / 114), *Ready* and a folder filtering the list; no horizontal scroll, no page errors. Showcase, external sources, rooms and projects are empty here, so only their empty states and folds were seen.

## Settings as a tree, Integrations inside it (freelee #93)

**Owner, 2026-11-16:** "polish the Settings section while you are at it — integrations should live there."

**Connections is now Settings → Integrations.** `SETTINGS_MAP` gains the group *Integrations*: **All integrations** (`?section=integrations`) and one section per `CONNECTION_GROUPS` entry (`?section=integrations-<group>`: AI providers, Tools for bots, Knowledge, Email, Payments, Storage). The *Elsewhere* group is gone; Branding sits under *Appearance*. The sidebar's System group loses *Connections*.
- An Integrations section is the browser list without a rail (`browser.hideRail` — its groups are Settings' own sections): name and description, group (on All), last test, health badge. A row opens the connection's card in the sheet: `ConnectionCardFor` (`connections-list.tsx`, the actions bound on the server) passed as `ResourceItem.detail`.
- **Addresses** (`connection-groups.ts`): `connectionHref(id)` → `/admin/settings?section=integrations-<group>&open=<id>`, `integrationsHref(group?)`. Every link that pointed at `/admin/connections#…` uses them (the homeschool hub, the category agent's no-key notice, the persona form's curriculum hint, the Settings hints, the dashboard's attention items go to *All integrations*).
- **Old links.** `/admin/connections` redirects in `next.config.ts` (HTTP 307), because only an HTTP redirect keeps the fragment: a `redirect()` in the page can arrive inside a stream, and `#conn-anthropic` was lost (seen live before the fix). `IntegrationsList` reads the fragment once (`hrefForConnectionsHash`): `#conn-<id>` opens that card, `#group-<id>` that group. `MOVED_SECTIONS` sends `?section=connections` and `?section=storage` there too. The page file remains as a fallback.
- **"One key, one home" is unchanged:** the same 13 connections in the same groups, the same `SECTION_FIELDS`; only the address and the layout moved.

**The Settings tree.** `SettingsNav` is the taxonomy's rail: eyebrow headings, one compact `RailItem` per section with its icon (`RailItem` gained `icon`, `meta`, `title`), the description as the tooltip and as the heading over the form. Integrations entries show **working/total** (`2/13`, `1/6`), the tooltip the full breakdown. From `lg` it is a sticky 15rem column, below that a fold (*Settings: AI defaults*), as the taxonomy's tree.

Checks (`admin:verify-settings-map`): a section per group plus All; `connectionHref` for Anthropic and the curriculum; the old anchors map to the card or group and nothing else; the moved sections redirect into Integrations.

**Verified live** (1280, 1600, 390): the tree (General … Branding, `2/13`, `1/6`, `0/2`, `1/1`, `0/1`, `0/2`, `0/1`); `/admin/connections#conn-anthropic` → `?section=integrations-ai&open=anthropic` with the Anthropic card open; `#group-payments` → Payments; `?section=storage` → the S3 card; All integrations lists 13; Esc closes; the AI defaults hint links *Integrations → AI providers*; the sidebar has no Connections; no horizontal scroll, no page errors. **Not verified:** Save, Test and Fetch from inside the sheet — they are the same card and actions as before, but no key was changed.

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
