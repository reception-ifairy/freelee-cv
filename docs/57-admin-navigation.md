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
