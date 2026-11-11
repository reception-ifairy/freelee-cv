# Bot teamwork & projects in the admin panel

Two multi-bot modules already existed and were **completely invisible to the admin panel**:

- **`crews`** — bot-to-bot orchestration; three modes, hard caps, four tables.
- **`group-chat`** — rooms where several personas reply to `@mentions`.

Both ship and work, and `find src/app/admin` returned no crews, no rooms, no conversations. Every
operation was end-user-scoped to `user.defaultTeamId`; there was no operator view of any of it.

This page covers **Stage 1: projects** — the container the rest hangs off.

## What a project is

A named grouping of work: chats, rooms, bot teams and their runs, with a status and a budget.

There was no such concept anywhere — `grep -rniE "\bprojects?\b"` returned only OpenAI header names
and English prose. "Folders" is the **first** entry in the Deferred column of
`docs/13-group-chat.md`, scoped out at the time and never revisited. The only grouping primitives
were `teams` (the tenant) and `crews` (a grouping of personas, not of work).

## Deleting a project never deletes the work

Every `project_id` is nullable and `ON DELETE SET NULL`. Work created before projects existed keeps
working with a NULL project, and deleting a project leaves its chats, rooms and crews intact —
merely unfiled.

Losing a month of conversations because somebody tidied up a folder would be unforgivable, so this
is verified rather than assumed: filing 2 of 8 chats into a project and deleting it leaves **8 chats,
0 filed, all alive**.

## `budget_credits` is nullable on purpose

`NULL` means *no cap*. That is not the same as a budget of zero, and `NOT NULL DEFAULT 0` would make
the two indistinguishable forever.

**It is a pre-flight check and a reported total, not a hard limit.** The wallet `spendCredits` locks
is team-scoped (`credits.ts:118-119`), so enforcing a project cap at spend time would mean threading
a project through every call site including 1:1 chat. The form says so in as many words rather than
implying a guarantee it does not provide.

Spend attribution needed **no ledger migration**: `SpendOptions` already carries
`meta?: Record<string, unknown>`, so a run tags its spend with `meta.projectId` and the project total
is a query over `credit_transactions` — the ledger stays the source of truth, and
`projects.credits_spent` is only ever a cache.

## The bug this turned up — for the third time

The list page counts chats, rooms and crews per project with correlated subqueries. Drizzle emits a
**bare `"id"`** for the FROM-table's own column inside a `sql` template, and inside a correlated
subquery Postgres resolves that against the **inner** table:

```sql
-- what was emitted
(select count(*) from chats where project_id = "id")   -- "id" → chats.id
```

So every chat was compared to *its own id* — always false, always zero. The credits subquery crashed
outright with `operator does not exist: text = bigint`, which is the only reason it was noticed at
all; the three count subqueries would have silently reported zero forever.

**This is the third appearance of this exact bug in this admin.** `/admin/packs` 500'd on it, and
`/admin/customers` reported 0 chats for every customer because there the comparison was `text = text`
and failed silently. Fixed by qualifying explicitly with `sql.raw('"projects"."id"')`.

Verified against ground truth rather than by the page rendering: 3 chats and 120 credits in Postgres,
3 and 120 on screen.

## Naming

`teams` already means *tenant* throughout the schema, so a nav item called "Teams" would collide with
the most load-bearing noun in the app. The group is **Teamwork**; the feature keeps its existing name,
**Bot teams**, at `/admin/crews` so route and table never drift.

It sits directly after **AI** rather than in System — a bot team is personas working together, so it
belongs beside personas.

## Verified

| Check | Result |
|---|---|
| Migration dry-run in a rolled-back transaction | ✅ 13 columns, 3 FKs attached |
| Counts against ground truth | ✅ 3 chats / 120 credits, matching Postgres |
| Delete a project with work filed under it | ✅ 8 chats before, 8 after, 0 filed |
| Empty state, create, edit, breadcrumb | ✅ |
| All suites | ✅ 103 assertions + changelog |

## Still ahead

Stage 2 (job queue), Stage 3 (bot team CRUD), Stage 4 (runs + the `crew_run_steps` audit trail that
has no reader today), Stage 5 (rooms oversight).

---

# Stages 3–5 — bot teams, runs and rooms

## Bot teams: the CRUD that never existed

Crews were **create-only**. No edit, no delete, no cancel, no way to add or remove a member or change
the order, and `crew_members.instructions` — a per-member prompt append the runner genuinely uses —
had never been written by any UI. `docs/14-crews.md` admitted *"delete + recreate today"*, and there
was no delete either.

`/admin/crews` and `/admin/crews/[id]` close all of it, including **drag-to-reorder** turn order via
`@dnd-kit`, copying `block-list.tsx` — which also carries the lesson that server rows must be resynced
into state rather than parked there.

**A real bug ~~fixed~~ — not fixed, see the builder rework below:** the create form said *"Order
above sets sequential turn order"* while `createCrewAction` derived `position` from **database row
order**. In pipeline mode that order is the entire behaviour of the feature, and it was arbitrary
while the UI claimed otherwise. ~~`formData.getAll` preserves submission order, so the order you tick
is now the order you get.~~

> **Correction (2026-11-11, #63).** That last sentence was wrong. `formData.getAll` preserves
> *submission* order, and a browser submits checkboxes in **page** order, not the order they were
> ticked — and the admin list was sorted by name. So every admin-created team started out in
> alphabetical order (only the drag board could change it afterwards), the hint "the order you tick
> them is the order they run in" was false, and the customer-side `createCrewAction` was never changed
> at all. Both are fixed in the builder rework.

Mode labels are translated: `sequential`/`parallel`/`supervisor` are accurate but jargon. What they
mean is a **pipeline**, a **fan-out** and a **delegator**.

## Runs: the audit trail nobody could see

`crew_run_steps` has been written on every step since crews shipped and **read by nothing**. Per-step
credits, errors, timings and the linked message all existed with no screen.

`/admin/crews/runs/[id]` shows the step timeline beside the transcript, live while the run is going,
with a working **Stop run**. Step durations are metered against the slowest step so a stall stands out
without reading numbers.

**The transcript reuses `MessageBubble` unchanged**, with `speaker` and the `flat` bubble style — a
pair that has existed since the chat-layouts work with no admin surface using it. That means markdown,
guardrail callouts and narrative layouts all behave here exactly as they do in the product, because it
*is* the product's renderer. A second one would drift within a release.

Polling, not the SSE stream: `/api/rooms/[id]/stream` authorises by `assertParticipant`, and an admin
watching somebody else's run is not a participant. Adding an admin bypass there would widen who can
open a live feed of any conversation on the platform — a bigger decision than this screen should make.

## Rooms: every conversation, across teams

`/admin/rooms` lists all of them including crew runs, clearly labelled.

**A real bug fixed on the user side:** `/rooms` selected by `teamId` with **no `kind` filter**, so
every `crew_run` conversation appeared in a user's Rooms list as an ordinary room — and could be
posted into after the run had finished. Runs have their own view; the user list now filters to
`kind: 'room'`.

## The attribution bug — the most consequential one

`mentions.ts` labelled every past persona message with `participant.mentionHandle` — the handle of the
persona **currently speaking**. In any room with two personas, and in every crew run, each member was
told it had said everything its teammates said.

The whole premise of multi-persona work is that they can tell each other apart, so this quietly
undermined the feature it was part of. Now each line resolves its own author's handle.

Verified on a real 3-persona run: `[you]`, `[llama-local]`, `[zz-researcher]`, `[zz-writer]` — four
distinct speakers where all three personas would previously have shared one handle.

## Verified

| Check | Result |
|---|---|
| Team list, mode labels | ✅ |
| Drag-to-reorder turn order | ✅ 3 handles |
| Start a run from admin | ✅ enqueued, redirected, live badge |
| Step timeline with real durations | ✅ 3 steps, 9.2s on step 1 |
| Transcript via `MessageBubble` | ✅ markdown + speaker labels |
| Rooms oversight, crew runs labelled | ✅ |
| Speaker attribution | ✅ 4 distinct handles |
| All suites | ✅ 103 assertions + changelog |

---

# Builder rework (#63) — 2026-11-11

The owner's brief: *"Focus on teamwork. Navigation and creating a team must be simpler and
intuitive."* Admin stays English, in plain words with no jargon; the admin builder comes first, and
only shared bug fixes reach the customer side.

## What was wrong

Building one team took three screens that each owned part of it and disagreed:

- an **inline create form** beside the list — ten controls, including a checkbox list of every active
  persona with no search, and the false "tick order" hint above;
- a **drag board** (`team-assign.tsx`) on the team page that saved membership on every drop;
- a **settings panel** (`crew-settings.tsx`) with the same fields as the create form, plus the only
  supervisor select — which listed **every persona on the platform**, not the team's members.

And three bugs nobody could see from the screens:

- **Roles were wiped on every save.** `saveCrewAction` rebuilt members with
  `instructions: formData.get('instructions-<id>')` — a field no screen ever rendered — so every
  "Save team" reset each member's `crew_members.instructions` to `NULL`. There was also no input for
  it anywhere, so the column the runner reads was write-only by accident.
- **Removing the supervisor by drag** silently fell back to the first member at run time.
- **Raw values on screen:** `sequential · 6 turns · 50 credits`, "max turns reached", "sequential
  complete" — enum values with the underscores swapped for spaces.

## What it is now

**One builder, `src/components/admin/team-builder.tsx`,** used by `/admin/crews/new` and by the
**Build** tab of `/admin/crews/[id]`. Three numbered sections and one Save:

1. **What is this team for?** — name, goal, and three mode cards with a one-line explanation and an
   example each: **One after another** (`sequential`), **All at once** (`parallel`), **A lead bot
   delegates** (`supervisor`). Stored values are unchanged.
2. **Who is on the team** — a search box over the persona pool (name, category, sector, expertise),
   results as cards with **Add**. Personas without a published version are shown, disabled, as "Not
   published yet". The chosen list is a single `@dnd-kit` sortable (the `block-list.tsx` set-up, not
   `team-assign.tsx`'s cross-container one) with up/down buttons beside the grip, a **Role on this
   team** box per bot (→ `crew_members.instructions`), remove, ordinals (1st, 2nd…) in *One after
   another* only, and in lead mode a crown toggle — only on member rows, so the lead is always a
   member, and always exactly one.
3. **Limits** — collapsed under "Advanced" with a one-line summary of what is set: budget, turn
   limit, stop phrase, project, enabled. Collapsed, not unmounted, so the fields still submit.

**Save sends members as one ordered JSON list** (`{ personaId, instructions, isLead }[]` in a hidden
`members` input), validated by `checkTeam` in `src/modules/crews/team-check.ts`: at least one bot,
no duplicates, lead mode needs exactly one lead *and* someone to delegate to, roles ≤ 1,000
characters. Position is the array index, so **the order on screen is the order saved**. Errors come
back with a `field`, and the builder shows them under that field (opening Limits if needed) and moves
the cursor there. Settings and members are written in one transaction.

**"All at once" with more bots than turns** raises the stored turn limit to the member count on save,
and the builder says so before (an info note) and after (the success message).

**The team page** has two tabs, as links (`?tab=runs`) so a tab survives a reload and can be linked
to:

- **Build** — the builder.
- **Runs** — a **Test run** box with a **pre-check** (`crewReadiness`, `src/modules/crews/readiness.ts`):
  team enabled; has bots; lead mode has a lead and someone to delegate to; every member has a
  published version (exactly what `runPersonaTurn` needs); the wallet that will be charged — the
  crew's own team, i.e. the platform wallet for admin-made teams — has at least `MINIMUM_CHARGE` or an
  active pass, with an amber note when it holds less than the team's budget. **Start** stays disabled
  with the first failing reason beside it, and `startAdminCrewRunAction` runs the same check again
  server-side. Below it, the runs list with plain outcomes.

The header reads e.g. *3 bots · one after another · up to 6 turns · budget 50 credits*
(`teamSummary`). After creating a team you land on it with a "Next, give it a small task" note
linking to Runs.

**The list page** has a **New bot team** button instead of the inline form; rows show the plain mode,
bot count, run count and the last run's outcome; the empty state explains a bot team in one sentence.

**Plain words** live in one place, `src/modules/crews/labels.ts`: mode copy, ordinals, the team
summary, and `runOutcome(status, stopReason)` — e.g. "Finished — every bot had its turn", "Stopped —
reached the turn limit", "Stopped — the lead didn't hand the task to anyone". The stop reason wins
over the status, because `failed` covers two different situations (below). An exception message the
runner recorded as the reason is shown as a detail line, not as the sentence.

## Runner fixes (shared with the customer side)

All in `src/modules/crews/runner.ts`, with the decisions pulled into `src/modules/crews/rules.ts` (no
`db`, no `server-only`, no zod — client components import it) so they can be checked for free by
`scripts/verify-crew-runner.ts`, now part of `npm run blocks:verify`.

- **Turn order.** Admin: the ordered JSON list above. Customer `createCrewAction`: position now
  follows submission order (deduplicated) instead of filtering the team's personas in database row
  order. Its checkbox list is sorted by name and submits in that order, which is what its hint
  ("Order above sets sequential turn order") has always said — so the hint is finally true without
  changing that UI.
- **"All at once" never drops members.** It ran `members.slice(0, maxTurns)` and reported
  `parallel_complete`, so a seventh bot under the default limit of 6 was silently skipped. The runner
  now uses `max(maxTurns, members)` (`effectiveMaxTurns`), and both start actions store that on the
  run so the run page's "turns used / limit" agrees.
- **The lead finishes only on a line that is DONE.** It was `/\bdone\b/i` over the whole reply, so
  "I'm not done yet — @writer, draft the intro" ended the run. Now a line must be exactly `DONE`,
  trimmed and case-insensitive. **Deviation from the brief:** markdown emphasis around it
  (`**DONE**`) and a closing full stop (`DONE.`) are tolerated, because models add both unasked and
  the alternative is recording a lead that clearly finished as "handed the task to nobody". "Done:
  here is the summary" still does not count.
- **"The lead named nobody" is no longer `completed`.** `supervisor_no_delegate` was missing from the
  status map and fell through to `completed`. The map is now total over a closed `StopReason` list,
  so a new reason cannot be added without choosing its status. The enum has no `stopped` value and
  adding one is a migration (out of scope), so the status is `failed` and the stop reason carries
  the distinction; every admin screen reads the reason first and says **"Stopped — the lead didn't
  hand the task to anyone"**.
- **The lead is told who its teammates are.** It was told to reply "with exactly one `@handle`" and
  never given the handles — teammates only appear in the transcript after they have spoken, which in
  this mode is only after the lead has named them. The lead's note now lists each teammate's handle,
  name and role.
- **Delegation picks the first teammate mentioned.** It used `parseMentions(…, 1)`, which returns
  matches in *participant* order and was cut to one *before* the lead itself was filtered out, so
  "@lead will review after @writer drafts" could resolve to nobody. `firstMentionedHandle` takes the
  earliest `@handle` that belongs to a teammate.

Smaller: `startAdminCrewRunAction` validated the task with `.parse()`, so a two-letter task threw to
the error page instead of showing a message; it is `safeParse` now. Members are ordered by
`(position, id)` everywhere a run reads them.

## Navigation

The Teamwork section is **Bot teams → Rooms → Projects** (the handbook's Teamwork part follows). The
admin **Rooms** list filters out `kind = 'crew_run'`: runs are reached from their team's Runs tab. A
run's transcript is still at `/admin/rooms/<id>` by link — which matters for a deleted team, whose run
records cascade away while the conversations remain (see `deleteCrewAction`).

## Retired

`src/components/admin/team-assign.tsx`, `src/app/admin/crews/[id]/crew-settings.tsx`, and the
`assignCrewMembersAction` / `reorderCrewMembersAction` server actions — nothing imports them any more,
and an unused server action is still a public endpoint.

## Not done here

- The **customer** crews pages keep their own form and still show raw statuses — "admin builder
  first" was the decision; they share only the runner and ordering fixes.
- No schema changes. A real `stopped` run status would need an enum migration.
