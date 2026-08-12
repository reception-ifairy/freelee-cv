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

### #42 · `pending` — Give the admin a visual foundation: tokens, one surface, and motion

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
