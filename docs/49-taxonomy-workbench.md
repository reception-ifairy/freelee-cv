# Taxonomy: a workbench for designing bots

Twenty fields, 103 specialisms and 70 audiences were researched properly and then went nowhere. This
turns the taxonomy from a filing cabinet into a **brief** — everything a specialist in a field would
need to be — and puts a design conversation on top of it.

## What was actually wrong

Not "the screens were plain". The data had no reader.

| Data | Rows | Read at runtime, before |
|---|---|---|
| `sectors.b2c/b2b/b2gSuitability` | 103, hand-scored 10–95, **none left at the 50 default** | no |
| `sectors.typicalRiskLevel`, `narrativeFit`, `primaryInteractionModes` | 103 | no |
| `categories.ukMarketSize`, `ukGrowthRate`, `ukKeyRegulations`, `ukIndustryBodies`, `defaultRiskLevel` | 20 | no |
| `AUDIENCE_SEGMENTS[].keyNeeds`, `preferredTone`, `riskSensitivity`, `ukContext`, age ranges | 70 | no — only `code` and `name` ever rendered |
| `persona_versions.audienceSegments` | — | one `startsWith('B2C-CYP-')` test |

The entire audience contribution to a system prompt was **three static sentences**, one per enum
value. Guardrails were the single piece of this research that reached a model, and they are the proof
the route works.

The structural cause was the same one sectors had before `0033`: **nothing pointed at a segment**.
A persona could tag itself with codes, but no edge connected a *field* to the people who work in it.

## `categoryBrief()` — one assembler

`src/lib/taxonomy/brief.ts` gathers the category, its sectors with suitability, its linked audiences
with their full payload, the layout its slug maps to, the tools `suggestedToolsFor` would tick, and
the guardrails whose own `appliesToRiskLevels` covers the field. One function, because the brief
already has more consumers than the page it was written for — and the recurring failure in this
codebase is data only one screen knows how to read.

It is split three ways for a reason that only shows up in testing:

- `types.ts` — the shape
- `brief.ts` — the assembly, `server-only` because it queries
- `render.ts` — `briefForModel()`, deliberately **not** `server-only`, so the prose can be
  property-tested in `blocks:verify` without a database. The assembly needs Postgres; turning the
  result into words does not, and the words are the half with edge cases in them.

The largest of the twenty briefs is **652 tokens**. All 20 produce a valid one.

## Audience, connected

`category_audience_segments` (`0037`) is the missing edge, and `0039` seeds the 26 obvious matches —
twelve of the B2B segments name an industry outright (Legal Services, Healthcare, Financial Services,
Creative Industries, HR and Recruitment), and several B2G ones are the public-sector half of a field
we already have a category for. The rest is picked in the panel, because it is editorial judgement:
sector suitability says "this field sells well to business", which does not tell you *which*
businesses.

**No foreign key on `segment_code`**, deliberately: the catalogue is a TypeScript file, not a table.
A code with no catalogue entry is dropped when the brief is assembled rather than rendered as a stray
string, so a segment renamed in source cannot leave a ghost on screen.

**And it reaches the model.** `buildSystemPrompt`'s `## Audience` section now compiles the persona's
segments with their real payload — needs, preferred tone, age range, UK context, how badly a wrong
answer lands. Measured: **+139 tokens for two segments**, and the difference between

> This persona is optimised for the **Consumer (B2C)** audience.

and

> - **Early Years** (aged 3–5, Nursery, Reception) — they need play based learning, phonics
>   introduction, emotional regulation… They respond to a playful, gentle, encouraging, simple voice.

Capped at four segments: a persona tagged with a dozen is describing everybody, and paying for all
twelve on every turn buys a description that has stopped saying anything.

## The workbench

`/admin/taxonomy/[id]` carries a design conversation that already has the brief in front of it.

**Stored as `conversations` with `kind: 'playground'`** — an enum value that has existed since the
group-chat module shipped, that `/admin/rooms` already renders a badge for, and that **nothing had
ever written**. It was reserved for exactly this.

Deliberately not a `chats` row. Those are customer property: `assertChatAccess` is an owner-id or
guest-cookie match with no concept of an admin, an admin-owned chat would appear in the customer
`/chat` sidebar, and every turn would bill a wallet.

**`/api/admin/workbench` rather than a flag on `/api/chat`**, because the three differences are the
kind that cannot be a flag: nobody is billed, authorisation is `requireAdmin`, and there is no persona
— the system prompt *is* the category brief.

**The UI is the product's own chat window.** `ChatWindow` gained one prop, `apiPath` (plus `apiBody`),
and everything else — composer, bubbles, layouts, suggestion chips — came free. `RunTranscript`
already proved `MessageBubble` renders inside `/admin/**` with no `chats` row. Capabilities that
assume one (images, speech, transcription) are off.

### Build a draft

Reuses `convertedPersonaSchema` — the vocabulary for "a persona described as JSON" already exists,
with its own validation and repair. The import improves on the bot converter's in the three places
where the converter deliberately guesses and here we know:

- the **category** is the page you are on, so `persona_categories` is written rather than cleared;
- the **sector** was chosen in the workbench, so `personas.sector_id` is written;
- the **audience** comes from the category's links, and the type falls back to whichever the field
  actually leans towards — the average of hand-scored sector suitability, not a guess.

Created `isActive: false` with `pinVersioning`, so it lands as a genuine `draft` version rather than a
published 1.0.0. `/admin/taxonomy/prototypes` lists them.

## The taxonomy is now in git

This is the change that mattered most and was least visible.

`drizzle/0003` is 34 lines of pure DDL with **zero inserts**. `src/db/seed.ts` seeds eight *different*
categories with different slugs. The curated dump everything was backfilled from is not in this
repository and not on this server. **A fresh install produced 20 categories with every UK column NULL
and no sectors at all.**

`scripts/export-taxonomy.ts` writes the live data back out as `drizzle/0038_taxonomy_seed.sql`,
matched on natural keys throughout — categories by slug, sectors by `(category slug, sector slug)` —
because live category ids start at 29 *and are load-bearing* (`markSpec` picks a persona card's cell
shape from `categories.id`), so they must be neither assumed nor forced.

It was verified by **restoring it**, not by reading it: a scratch database, the structure, the three
migrations, then a row-by-row diff of all 123 rows against production. Identical. A second run changed
nothing.

That test also found a real ordering bug: the audience seed lived in `0037` and matched on category
slug, so on an empty database it inserted **nothing** — the categories did not exist yet. Hence
`0037` DDL, `0038` data, `0039` links.

## Bugs fixed on the way

- **`personas.sectorId` had no writer.** `persona-form.tsx` contained the string "sector" zero times
  and `savePersonaAction` never set it — so the column that gives a persona card its third visual axis
  could only be set in SQL, while two handbook pages told you to set it on that form. There is now a
  picker, and the handbook is true again.
- **The admin persona list's audience filter was dead.** It read `personas.audienceType`, which
  nothing has written since Phase 4 moved audience to `persona_versions` — so it silently returned an
  empty list rather than erroring. The public catalogue always filtered the right column.
- **Sector slugs regenerated when the field was blanked**, and a sector slug feeds the persona mark's
  grid size and density — so blanking a field re-rolled the visual identity of every persona in that
  sector. Category slugs were frozen for exactly this reason in docs/47; sectors were missed.
- **Editing a category highlighted nothing in the sidebar.** `/admin/categories/29` shares no prefix
  with `/admin/taxonomy`, and prefix matching cannot express "this route belongs over there".
  `NAV_ADOPTIONS` can.
- **`levelOverride` was dead parameter surface** in `buildSystemPrompt` — no caller ever passed it,
  and `/api/chat` passed `undefined` positionally just to reach the argument after it. Removed.
- Four orphaned files deleted; `/admin/taxonomy` gained the `loading.tsx` it never had.

## Known gaps

- **`primaryInteractionModes` still reaches nothing.** It is in the brief a model reads, which is
  new — but `resolve-layout.ts` still does not use it, and the reasoning there (flattening sector
  modes up to a category fires for 20 of 20) still holds. A persona now *has* a sector, so the
  per-persona signal that comment asks for finally exists; wiring it is a separate change with its own
  measurement.
- **Category risk levels look under-set.** Education and Training is `R0` while carrying Safeguarding
  KCSIE and the Children's Code. The values are derived from sector risk and may want revisiting —
  that is a data decision, not a code one, and it now shows up on the category page where it can be
  seen.
- The workbench takes JSON by paste rather than through a tool call. `stopWhen: stepCountIs(5)` makes
  a tool round trip resend the whole brief on every step, which is the same "pay twice" problem
  documented in docs/48; paste costs nothing and is honest about what it does.
