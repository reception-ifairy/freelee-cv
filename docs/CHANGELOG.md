# Changelog

Every update to freelee.cv, newest first. One entry per commit on `main`.

Each entry records **what changed, why, and where to read more** — the detailed doc, and the
migration if the update touched the database. The commit message itself always carries the full
reasoning; this is the index over them.

## How to read an entry

    ### #37 · `a4f361d` — Add an admin-only bot converter
        │        │
        │        └── the git hash, for `git show a4f361d`
        └── the update number: #1 is the initial commit, and it counts up from there

**Use the number, not the hash.** `#37` is something you can hold in your head, say out loud and
order against `#36`; `a4f361d` is none of those things, and no two hashes tell you which came first.
The number is a commit's position in `git log --reverse`, so it is derived rather than maintained —
it cannot drift out of step, and `npm run changelog:verify` checks it.

The newest entry may carry `` `pending` `` instead of a hash: the entry is written in the same commit
as the change, so the hash does not exist yet. It is filled in on the next update, and the check
fails if anything older than the newest entry still says `pending`.

Conventions used throughout:

- **Migrations** are hand-written SQL in `drizzle/00NN_*.sql`, applied with `psql`, never without
  asking first. `drizzle-kit` hangs non-interactively on this box.
- **Verification** means against the live site — real API calls, real database assertions — not a
  passing typecheck. Where an entry says "verified", that happened before the commit.
- **Docs** live in `docs/`, indexed by `00-overview.md`.

---

## 2026-08-11

### #53 · `pending` — Write up the persona cards for the person running the site

The engineering doc explains why a persona is never a face; the handbook has to
explain what to do about it. New page under Personas covering the generated
mark and what changes it, the flip, the merged Taxonomy screen, and dragging
persona cards onto a bot team. The category-address warning lands here too —
renaming is safe, the address is fixed, and the reason is behaviour keyed to it.

Basics tab now lists category and sector as real fields, and accent colour no
longer claims to colour an avatar tile that no longer exists. Bot teams replaces
"tick the personas you want" with the two-column drag interface that shipped.

📄 `47-persona-cards.md`

### #52 · `10cee9a` — Give AI personas a generated identity, never a face

A milestone: a persona is never represented by a human face. The audit found
there were none to remove — every persona visual was initials on a colour, and
personas.avatar has never been written or rendered on a card — so this is a
mandate not to introduce them plus something better than two letters.

The mark is pure deterministic SVG from category (colour + geometry), sector
(density) and the persona (which cells fill), mirrored about the vertical axis.
Property tests caught three things eyes would not: hash-derived shape gave 9
squares and 1 circle across the real 20 categories (now from the category id,
5/5/5/5); the empty-mark fallback could never satisfy its own condition; and
aria-controls pointed at an id attached to nothing.

The card flips to access and depth. Three layout bugs found by measuring: a
grid item's min-width:auto widened its column past the viewport, an implicit
auto column made a card 602px inside a 289px slot, and a JSX comment written
with // rendered as visible text.

Cross-container drag-to-assign is new — pool cards were outside any
SortableContext (renders fine, cannot be picked up) and closestCorners never
resolved across two columns; pointerWithin does.

Sectors were write-only: 103 curated rows read by nothing, because no persona
pointed at one. personas.sector_id fixes that, /admin/taxonomy merges the two
screens, and category slugs stopped regenerating on rename — they are a
behaviour contract that CATEGORY_LAYOUT and tool suggestions key off.

📄 `47-persona-cards.md` · 🗄 `0033_persona_sectors`

### #51 · `f7b4b7b` — Document the teamwork work properly: handbook, docs and README

The handbook gained a Teamwork part — Projects and Bot teams, written for the
person running the site rather than the person maintaining the code — and its
existing "One assistant, or a team?" page was corrected: it still described
crew runs as something you wait for, which stopped being true when they moved
onto the job queue.

Two docs made false claims and now say so. docs/14-crews.md described
synchronous execution and an inert SSE path as current; that section is marked
superseded and kept for its reasoning, with a then/now table, because the
tripwire it named is exactly the one that was hit.
docs/09-team-authorization.md justified manual module sync by "no queue infra",
which is no longer true — the decision stands on a different reason and now
says which. docs/06-operations.md gained a job-worker section, since a deploy
runbook that omits a process running in production is a trap.

The README was ~20 commits stale: no projects, no job queue, no teamwork, no
changelog pointer. It now leads with the changelog as the record of every
update.

Also fixes a real bug found by a liveness probe: db.execute returns raw
snake_case driver rows, so `RETURNING *` gave max_attempts rather than
maxAttempts and retryOrFail compared a number against undefined — a permanently
failing job would have retried forever.

📄 handbook `projects` + `bot-teams`, `06-operations.md`, `14-crews.md`, `46-job-queue.md`, `README.md`

### #50 · `f67c708` — Add the admin Teamwork section: bot teams, runs and rooms

Stages 3-5. Crews and group-chat both shipped with zero admin surface — `find
src/app/admin` returned no crews, no rooms, no conversations.

Bot teams were create-only: no edit, no delete, no member reorder, and
crew_members.instructions had never been written by any UI. All closed,
including drag-to-reorder turn order. Fixed a real bug there: the form said
"Order above sets sequential turn order" while position came from database row
order — in pipeline mode that order is the entire behaviour of the feature.

The run view finally reads crew_run_steps, written on every step since crews
shipped and read by nothing. Step timeline beside the transcript, live, with a
working Stop. The transcript reuses MessageBubble with `speaker` and the flat
layout — a pair that already existed with no surface using it — so it is the
product's renderer rather than a second one that would drift.

Rooms oversight lists every conversation across teams. Fixed the user-side
/rooms list, which had no kind filter, so finished crew runs appeared as
ordinary rooms and could be posted into.

And the most consequential fix: mentions.ts labelled every past persona message
with the CURRENT speaker's handle, so in any multi-persona room or crew run each
member was told it had said everything its teammates said. Verified fixed on a
real 3-persona run — four distinct handles where all three shared one.

📄 `45-teamwork-and-projects.md`

### #49 · `0d17923` — Move crew runs onto a real job queue

Stage 2. Crew runs executed inline inside the server action, which is why
crews.max_turns defaults to 6 — a run had to finish inside one HTTP request.
That capped what bot teamwork could be, and it left the fully-built SSE
realtime path inert because the run was always over before the page rendered.

Postgres is the broker: SELECT ... FOR UPDATE SKIP LOCKED, no Redis, no second
pm2 process. The worker runs in-process from instrumentation.ts, guarded
against the edge runtime, next dev's double register(), and next build.
Delivery is at-least-once, so executeCrewRun's existing status guard is
load-bearing; a partial unique index keeps one live job per run.

Cancellation is cooperative — checked between steps, since a provider call in
flight cannot be aborted. crew_run_status gained 'cancelled', because
TERMINAL_STATUS's fall-through would otherwise record a deliberately stopped
run as 'completed'.

Two bugs found while verifying. Every step duration in the audit trail was
NEGATIVE: recordStep set completedAt from Node while startedAt used the
column's defaultNow(), evaluated at INSERT — after the step finished. Nothing
has ever read crew_run_steps, so nobody noticed. And parallel mode checked its
budget only after the fan-out.

📄 `46-job-queue.md` · 🗄 `0032_jobs`

### #48 · `36dbba5` — Add projects: the grouping of work that never existed

Stage 1 of bot teamwork in the admin panel. Two multi-bot modules already
existed (crews, group-chat) and were completely invisible to admin; nothing
grouped work at all. "Folders" was the first entry in the Deferred column of
docs/13-group-chat.md and never came back.

A project groups chats, rooms and bot teams with a status and a budget. Every
project_id is nullable and ON DELETE SET NULL, so deleting a project never
deletes what was done inside it — verified, not assumed: 8 chats before, 8
after, 0 filed. budget_credits is nullable because "no cap" and "a cap of zero"
are different intentions, and it is honestly a pre-flight check rather than a
hard limit, since the wallet spendCredits locks is team-scoped.

Spend attribution needed no ledger migration — SpendOptions already carries a
meta bag.

Turned up the unqualified-correlated-subquery bug for the THIRD time in this
admin: Drizzle emits a bare "id" inside a sql template, which Postgres resolves
against the inner table, so every chat was compared to its own id. The credits
subquery crashed with text = bigint, which is the only reason it was caught;
the three count subqueries would have silently returned zero forever, exactly
as /admin/customers once did.

📄 `45-teamwork-and-projects.md` · 🗄 `0031_projects`

### #47 · `c5ede95` — Give visitors their own navigation, and make /bionic part of the same site

Every menu_items row was visibleTo 'all', so a first-time visitor and a paying
customer saw an identical five-link bar — opposite jobs. Visitors now get a
four-section mega menu (Personas, Platform, Pricing, Resources) with described
links and a promoted rail; members get a flat workspace nav that marks the
current section. The catalogue is a logged-out experience, which is what the
marketplace UX research consistently says.

There was no mobile navigation at all below 1024px — the same gap the admin
sidebar had. It is accordions rather than a shrunk mega menu, portalled for the
backdrop-filter containing-block reason, with the visitor CTAs pinned.

/bionic used zero brand tokens — hardcoded cyan and purple on a fixed
bg-gray-950 — so the theme composer never reached it, and it had \u2014 and
\u2019 escapes rendering literally in the copy. Both fixed. The re-tune
exposed the text-white trap again: a gradient button whose right half is now
brand-600 had an invisible white label under Sovereign.

New shared surface classes, including .surface-overlay — an overlay is not a
raised surface, and the mega panel initially showed the hero headline straight
through itself.

📄 `44-public-navigation.md`

### #46 · `e86314a` — Finish the visual pass: translations, providers, branding, marketplace, docs

Stage 4d, the remaining screens.

The translations matrix put its colour on the text, so a module at 2/40 and one
at 39/40 both read as amber; cells get a track and each locale a headline
percentage, computed from figures already in hand. Providers rendered isActive
nowhere despite submitting it on every save, and model-row's status badge
shared its slot with the save spinner — so a model's status vanished during
every edit. Branding showed no colours on a branding screen. Marketplace was
the one screen with a raw h1 instead of PageHeader, printed raw cents as
"{n}¢" while formatMoney was used everywhere else, and put a neutral install
count in a green badge. Knowledge sources had ten inputs in two anonymous
grids, now two fieldsets for two genuinely different jobs. And the docs nav
stripped the file numbers the list is ordered by, making a deliberate sequence
read as an alphabetical pile.

📄 `43-admin-visual-system.md`

### #45 · `8ea33e2` — Give the dashboard trends and the persona form a way to show where the error is

Stage 4. The dashboard's bar chart was the only visualization in the panel and
every tile beside it was a naked number — the figure, never whether it was a
good month. Trends now compare against the previous 30 days, which needed a
real query rather than a guess; growth from zero returns null instead of
"+∞%", so the line disappears rather than printing something untrue. Messages
gets a sparkline from perDay, already fetched for the chart and used nowhere
else. The chart gets gridlines, a labelled peak and a hover readout. Top
personas get bars on the scale already computed above them.

Activity rows get an icon and colour per action type — activityLog.action was
being fetched and used only as a fallback when description was null, so the
feed was a grey paragraph you could not skim for "did anything get deleted".

Customer detail: a spent-vs-purchased meter (two numbers left the reader to
divide one by the other), coloured debits (spend was the harder half to find),
and the suspended banner — isActive was rendered nowhere on that screen.

Persona form: real tab labels with icons instead of raw lowercase array values,
and an amber dot on any tab holding an empty required field. Panels are hidden
rather than unmounted so a hidden field still submits, which meant an empty
input on tab 1 blocked the submit while you stood on tab 5 with no pointer.
The ten personality sliders get a midpoint and named poles — "formality: 20"
is meaningless until you know what the other end is.

📄 `43-admin-visual-system.md`

### #44 · `5b586b6` — Give the admin lists shape: meters, real empty states, and the data they already had

Stage 3, across all sixteen lists at once. ResourceItem.meta.value was already
typed React.ReactNode and every list passed a plain string, so meters needed no
change to the list contract.

Sectors is the clearest case: three 0-100 suitability scores rendered as the
string "70 / 40 / 20". They exist only to be compared with each other and a
reader cannot rank them by eye; as bars on a shared scale you can read a
sector's audience across 103 rows without decoding a digit. Also metered:
customer credits and chats, pack orders, post views, personas per category —
each scaled against the largest value on the page rather than its own row.

Three lists were fetching data, mapping it through their row type and never
rendering it: leads' personaName, posts' authorName, and categories' colour
(a size-3 dot beside everyone else's size-9 avatars). Three others printed
redundant columns restating a badge or the subtitle. leads and sales printed
raw database enums as badge labels — `new`, `paid` — directly beside
LEAD_KIND_LABELS, which does exactly that translation for the badge next to it.

Empty states now name the thing, say what it is for, and offer the action that
fills it. Not done: plans and passes still have no Edit action, because they
have no [id] route to link to — a missing screen, not a missing link, and
building one is a feature rather than a visual fix.

📄 `43-admin-visual-system.md`

### #43 · `89af04e` — Make the admin sidebar say where you are, and work on a phone

Stage 2. The sidebar was the weakest surface in the panel and the one every
session starts at. It could not tell you which page you were on — the layout
was a Server Component that never read usePathname, so all 23 links rendered
identically — and below 1024px there was no navigation whatsoever, just a text
link back to the dashboard.

Active state is now three signals at once (rail, tinted row, full-strength
icon), matched longest-prefix so a detail route still highlights its section.
Icons take one hue per group, carried as data so a new page inherits its
group's colour; deliberately not brand tokens, since .admin-console re-binds
those to one sky ramp and would produce 23 identical blue icons.

The drawer initially opened 63px tall with its links clipped away. The header
carries backdrop-blur, and a backdrop-filter makes an element a containing
block for fixed descendants — so `fixed inset-0` resolved against the 64px
header rather than the viewport. Only measuring the geometry found it; every
functional assertion passed while the thing was unusable. Fixed with a portal.

Also: breadcrumbs, next/font replacing three render-blocking link tags, a
max-width on main, and an icon on Sign out.

📄 `43-admin-visual-system.md`

### #42 · `90b1fda` — Give the admin a visual foundation: tokens, one surface, and motion

Stage 1 of the admin visual pass. An audit of all 35 routes found the problems
were structural rather than decorative — the panel was missing whole categories
of UI vocabulary. No radius or motion tokens, four competing surface recipes,
two keyframes in the codebase neither of which was used in admin, no
`prefers-reduced-motion` anywhere, and zero `loading.tsx` files app-wide.

Two live bugs fell out. The header's logo tile was **transparent**, not
mis-coloured: Tailwind emits a utility from the `@theme` namespace, and with no
`--color-brand-950` there, `bg-brand-950/50` was never generated. Only a
browser check caught it — defining the token in `.admin-console` made it
resolve while the tile stayed `rgba(0,0,0,0)`. And `.glow-btn:hover` changed
`box-shadow` with no transition on it, appearing to animate only because
`Button` carries a blanket `transition`.

New: `Meter`, `Sparkline`, `Skeleton*`, `EmptyState`, `StatTile`,
`useMountTransition`, `Button loading`, and `loading.tsx` on 15 routes.

📄 `43-admin-visual-system.md`

### #41 · `9d83c70` — Fill in #40's hash

Housekeeping, and the cycle `changelog:verify` enforces made visible: an entry
is written with `` `pending` `` in the same commit as the change it describes,
because the hash does not exist yet — then filled in on the next update, which
the check requires rather than trusts.

📄 `CHANGELOG.md`

### #40 · `628d6d1` — Number the changelog entries so updates are readable

Seven hex characters are unreadable and unorderable by eye. "What changed in #37" is a question a
person can hold; "what changed in a4f361d" is not, and neither hash tells you which came first — so
the record was getting hard to follow exactly as it got long enough to be worth having.

Every entry now leads with its update number, `#1` being the initial commit. The number is a
commit's position in `git log --reverse`, so it is derived rather than maintained and cannot drift.
`changelog:verify` now checks the numbering as well as the coverage, and rejects a stale `pending`
hash on anything but the newest entry.

Stable as long as history is only appended to. Rewriting pushed history would renumber everything
after the rewrite — one more good reason not to.

📄 `CHANGELOG.md`

### #39 · `039c22b` — Record every update in a changelog, and check that it happens

The reasoning behind a change is at its clearest the moment it is made and gone a week later. `git
log` holds it but is a poor index — you cannot skim it for "when did scheduled publishing get
fixed" or "which update touched the database".

So: this file, backfilled from the full history, one entry per commit with the reason, the doc and
the migration. And `npm run changelog:verify`, because a standing instruction kept by hand is one
that quietly lapses.

The check matches **subject lines, not hashes** — a hash does not exist until the commit is made, so
a hash-based check could never be satisfied by the commit that adds the entry, and you would always
be one behind. Hashes still appear here, added once known; they are for the reader, not the check.

📄 `CHANGELOG.md`, linked from `00-overview.md` · ✅ 38/38 commits recorded


### #38 · `4323cff` — Resolve provider keys in one place, and carry the OpenAI org/project headers

Five call sites each resolved a provider's API key by hand with slightly different fallbacks. That
only mattered once there was a second thing to resolve — adding the OpenAI organization header would
have reached exactly one of them. Now one `resolveProviderKeys()` serves the chat route, the
translator, the moderation filter and the bot converter.

New optional settings `openai_organization` / `openai_project`, sent as `OpenAI-Organization` /
`OpenAI-Project`. Omitted entirely when unset (OpenAI rejects a blank organization header, which
would read as a bad key), and never sent to OpenRouter or Ollama, which share the wire format but
have no such concept. The health check sends them too — a "Test connection" that passes while a real
chat turn fails is worse than no test.

Verified against the live account: the org matches the key, all nine catalogued models exist, and
completions return `credit_balance_exhausted` — classified as `no-credit`, not `bad-key`. A real
guest chat turn still streams end to end.

📄 `10-ai-model-registry.md`

### #37 · `a4f361d` — Add an admin-only bot converter: a document in, a draft persona out

`/admin/personas/convert` turns a character brief, a legacy config sheet or an old bot's guidelines
into a full draft persona — prompt, opening line, suggestions, all ten personality traits and a
cognitive blueprint. Migration otherwise means retyping a brief into a six-tab form, which is the
sort of work that stops a migration happening.

`.docx`/`.xlsx` are parsed in-process with **no dependencies** (they are ZIP archives of XML and Node
ships `inflateRawSync`); PDFs go to the model as a file attachment, because font encodings genuinely
are a library's job. Admin only via `requireAdmin()`, rate limited to 20/hour — the action takes an
arbitrary upload and spends real API credit per call.

The persona is created **hidden** and no category is guessed. Also fixed `slugify()`: NFKD strips
combining marks, so `ą`/`ę` were fine but `ł` is one glyph with a stroke — "Biały Ząb" became
"bia-y-zab", across every slug in the app.

📄 `42-bot-converter.md` · ✅ 24-assertion extraction suite, now in `blocks:verify`

### #36 · `1dc767c` — Add the assistant hub's quick actions and a real leads table

BotVerse's hub idea, ported onto the existing assistant bubble: claim a trial, request a callback,
subscribe, ask about pricing. The timing is the point — the moment somebody is interested, not a
contact page three clicks later.

The original keeps leads in a module-level array that empties on restart; a lead is a person waiting
for a reply, so this uses a real table and an admin screen leading with "N people are waiting". The
capture endpoint is public, so the tool is validated against the catalog, only declared fields are
stored, and it is rate limited to 6/hour.

📄 `41-sovereign-and-hub.md` · 🗄 `0030_leads`

### #35 · `57f8104` — Adopt the SovereignAI design as a switchable theme

A monochrome editorial look, delivered as a palette preset plus an `editorial` hero variant rather
than a rewrite — one click in Branding, one click back. The hero is a server component with CSS-only
reveals; the original's animation library would have cost 40KB to fade text in on the first thing a
visitor waits for.

Exposed a real bug: primary buttons hardcoded `text-white`, which silently assumed a dark brand.
Fixed with `readableOn()` and a `--color-on-brand` token, swapped through 60 files.

📄 `41-sovereign-and-hub.md`

---

## 2026-08-10

### #34 · `300b0ca` — Fix the default accent, make surfaces composable, document the settings work

The default accent failed WCAG 1.4.11 (3:1 for non-text) on its single icon usage; moved to
`#d97706` and added `wcagNonTextVerdict`. Surface and text greys became composable tokens.

📄 `40-settings-and-models.md`

### #33 · `92dc766` — Show the real page beside the block list in the frontpage builder

`/admin/frontpage` gains the live preview the on-page editor already had. Needed
`X-Frame-Options: SAMEORIGIN` — `DENY` blocks a page framing itself.

📄 `19-frontpage-sections.md`, `36-on-page-editing.md`

### #32 · `9985f5e` — Refresh the OpenAI catalog and add a real provider connection test

`checkProviderHealth()` makes a real minimal completion and distinguishes `no-key` / `bad-key` /
`no-credit` / `error` / `ok`. A key being present is not a key that works, and a key that works is
not an account that can pay — this project has hit all three. Uses `max_completion_tokens`; newer
OpenAI models reject `max_tokens`.

📄 `40-settings-and-models.md`

### #31 · `3ab0405` — Rebuild Settings as a grouped hub and move the model catalog into it

Four groups with a sticky nav; `/admin/ai-models` became a redirect. Every model picker became a
dropdown.

📄 `40-settings-and-models.md`

### #30 · `a6452d7` — Replace the three-colour theme form with a palette composer

Seeds generate a full 50–950 ramp pinned at stop 600, with live WCAG contrast verdicts, surface
tints and a light/dark preview. Eleven presets.

📄 `39-theme-composer.md`

---

## 2026-08-09

### #29 · `c485dc3` — Add the site assistant bubble and the showcase module

The assistant **is a persona**, not a parallel chatbot — everything about it is edited at
`/admin/personas/<id>`. The chat is created on the first message, not on open. Brought the codebase
its first rate limiting: a free, unauthenticated LLM on every public page is otherwise an open
invitation to burn the API quota.

📄 `37-site-assistant.md`, `38-showcase.md` · 🗄 `0029_showcase`

### #28 · `06903bc` — Edit blocks on the live page, ported from ifairy.co.uk

Layout mode via `document.documentElement.dataset.layoutMode`; the studio sits bottom-left because
the assistant launcher owns bottom-right.

📄 `36-on-page-editing.md`

### #27 · `164d9a2` — Add URL-driven search, filtering, sorting and pagination to admin lists

State lives in the URL, so a filtered list is a shareable link and the back button works.

📄 `35-admin-lists.md`

### #26 · `075b4f2` — Rebuild every admin list as a grid with a labelled actions menu

Grid/list toggle with grid as the default, and a `⋯` menu replacing the row of bare icons.

📄 `35-admin-lists.md`

### #25 · `9a4b0eb` — Document the block builder and navigation

📄 `33-block-builder.md`, `34-navigation.md`

### #24 · `b7be404` — Fix scheduled publishing, put posts on the builder, fix a stale block list

**Scheduled publishing had never worked** — six queries filtered `isPublished` and ignored
`publishedAt`, so a future-dated post was live immediately. Centralised in `publiclyVisible()`.
`BlockList` also held server rows in `useState` and never resynced.

📄 `33-block-builder.md`

### #23 · `69d27f5` — Put CMS pages on the block builder, with a markdown fallback

### #22 · `b3d9bcf` — Add nested menus and accessible dropdown navigation

📄 `34-navigation.md` · ✅ 13-assertion menu-tree suite

### #21 · `2e42a64` — Add nine block types and the columns container

Nesting capped at one level, checked by `canNest()`.

📄 `33-block-builder.md` · ✅ 8-assertion nesting suite

### #20 · `9f4e5d9` — Rebuild the frontpage editor as a block builder with drag and drop

Eighteen block types, three scopes, a field schema driving the editing UI so a block's default and
its form control cannot drift apart.

📄 `33-block-builder.md` · 🗄 `0028_block_builder`

### #19 · `7b0545d` — Add live-data tools, transactional email, password reset, Sentry and Scribe

Sentry's `sendDefaultPii: false` **does not strip cookies or auth headers** — verified with a
capture server, then fixed with `scrubEvent()` covering transaction, contexts and breadcrumbs.

📄 `31-email-and-password-reset.md`, `32-observability.md` · 🗄 `0027_password_reset`

### #18 · `33d6bec` — Add ElevenLabs voice, with a total browser fallback

📄 `30-voice.md`

### #17 · `ffff50b` — Add tool calling, suggested per category

📄 `29-tools.md` · 🗄 `0026_persona_tools`

### #16 · `b3c5161` — Add local Llama via Ollama, and classifier-based input moderation

📄 `28-local-models-and-moderation.md`

### #15 · `7219b61` — Remove the generation reload, make media storage pluggable

### #14 · `9cfc074` — Implement the last four persona capability flags

📄 `26-vision-and-images.md` · 🗄 `0024_message_attachments`, `0025_image_generation`

---

## 2026-08-08

### #13 · `7a5b0bb` — Add Google (Gemini) as a chat provider, and run translation on it

📄 `25-google-provider.md` · 🗄 `0023_google_provider`

### #12 · `1d24efc` — Add conversation controls and a plain-language handbook

📄 `24-chat-controls.md` · 🗄 `0022_chat_controls`

### #11 · `484ba42` — Add category-adaptive chat layouts, incl. group and narrative variants

📄 `23-chat-layouts.md` · 🗄 `0021_chat_layouts`

### #10 · `1f6d1c6` — Rebuild translations around a modular word bank, add help tips

📄 `22-modular-word-bank.md` · 🗄 `0020_help_topics`

### #9 · `934a253` — Replace long picker dropdowns with grid UI, add live model fetching, add first image-generation engines

📄 `21-image-engines.md` · 🗄 `0019_image_engines`

### #8 · `c1d56b8` — Add frontpage section editor and modern branding system

📄 `19-frontpage-sections.md`, `20-branding.md` · 🗄 `0018_page_sections`

---

## 2026-08-06

### #7 · `d0b9764` — Replace hardcoded curriculum/universe grounding sources with an admin registry

📄 `18-knowledge-sources.md` · 🗄 `0017_knowledge_sources`

### #6 · `1b66b10` — Add /admin/translations panel — AI-driven add-language, export/import

📄 `17-translations.md` · 🗄 `0016_locales`

### #5 · `76d285a` — Add translation module — Polish + English, admin-controlled, phase 1 (frontend)

📄 `17-translations.md` · 🗄 `0015_translations`

### #4 · `461598c` — Fix: stale JWT session cookies crashing every page render

### #3 · `3752704` — Add coworker local-dev workflow and data export/import npm scripts

📄 `15-data-portability.md`

### #2 · `0885d4e` — docs: update deployment path references from releases/<timestamp> to app/

### #1 · `a6eb19f` — Initial commit: Freelee — AI persona marketplace

Next.js 16, React 19, Drizzle/Postgres, Auth.js v5, Vercel AI SDK, Tailwind 4. Shipped with teams,
persona versioning, billing, group chat, crews, data portability and the marketplace already in
place.

📄 `00-overview.md` through `16-marketplace.md` · 🗄 `0000_init` – `0014_marketplace`
