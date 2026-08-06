# Crews — Bot-to-Bot Orchestration

Shipped 2026-08-06, phase 7 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). Builds directly on Phase 6
(`13-group-chat.md`) rather than beside it — a crew run **is** a group-chat conversation, and a
crew step **is** `runPersonaTurn()`. Nothing about "how does a persona reply" was reimplemented.

## The core idea

A crew run creates an ordinary `kind: 'crew_run'` `conversations` row (the enum value has existed
since Phase 6, unused until now), adds every crew member's persona as an ordinary
`conversation_participants` row exactly the way a room does, then drives it by calling Phase 6's
`runPersonaTurn()` once per step — the same function a human's `@mention` calls. This is why
`src/modules/crews/runner.ts` is short: the actual "call the model, bill the team, save the
message, notify SSE listeners" logic lives in one place, not two.

The one change made to `runPersonaTurn()` to enable this: it now takes an optional `contextNote`
parameter (`src/modules/group-chat/mentions.ts`), defaulting to the existing "## Group chat" text
so every prior call site is unaffected. Crews pass a "## Crew" note instead, carrying the crew's
name/mode and the member's own `instructions` field.

## Three modes, one deliberately deferred

`crews.mode`: `sequential | parallel | supervisor`. A fourth, `graph` (arbitrary DAG of members and
conditions), is explicitly **not** built — the schema doesn't reserve a column for it and the enum
doesn't include it. Real value there is questionable without a visual editor to author the graph,
which is a much bigger v1 than this phase warranted; revisit if a concrete use case needs it.

- **Sequential** (`runSequential`, `src/modules/crews/runner.ts`) — a fixed pipeline. Each member
  runs once, in `crew_members.position` order, each seeing the whole conversation so far (handled
  by `runPersonaTurn`'s own history-loading, unchanged). Stops when every member has gone, a step
  fails, a stop phrase matches, or a cap is hit.
- **Parallel** (`runParallel`) — every member replies once, independently, in the same batch
  (`Promise.all`, exactly like Phase 6's `runMentionedTurns`). No pipeline; each member only sees
  the original task, not each other's replies within that batch.
- **Supervisor** (`runSupervisor`) — one designated member (`crew_members.isSupervisor`) is asked
  each turn to pick who acts next: reply with exactly one `@handle`, or the word `DONE`. Its reply
  is parsed with Phase 6's own `parseMentions()` — no new mention-parsing logic. This is the mode
  closest to genuine agentic delegation, and the one most worth watching in production for
  degenerate loops (a supervisor that never says `DONE`) — the turn cap is the actual backstop,
  not the model's good behavior.

## Hard caps, not suggestions

Every crew has `budgetCredits` (default 50) and `maxTurns` (default 6), checked before every step
in every mode. A run's terminal `status` reflects *why* it stopped —
`completed | failed | budget_exceeded | max_turns_reached` — not just that it did. This matters for
a feature whose entire premise is letting personas call each other without a human approving each
step; the plan's original design doc flagged exactly this as the risk to guard against
("hard `budgetCredits` cap, `maxTurns` counters, loop detection"). Loop detection here is the
turn cap itself plus an optional early-exit: `stopConditions` (case-insensitive substrings, e.g.
"TASK COMPLETE") checked against every step's reply — schema-ready extensibility beyond the
original plan's `stopConditions` mention, kept intentionally simple (substring match, not a real
rule engine) for a v1.

## Deliberate simplification: synchronous execution, no background worker

The original plan called for "background, not request-blocking" execution via a queued row and a
polling worker. **Not built that way.** No queue or background-worker infrastructure exists
anywhere else in this app (Phase 3's "nightly sync job" and Phase 5's "usage rollup" were both
scoped in their own plan sections but never actually implemented either — there was no real
precedent to extend). Standing up a new pm2 process, or an in-process poller, purely for crews'
first version was judged disproportionate. Instead, `startCrewRunAction()`
(`src/modules/crews/actions.ts`) calls `executeCrewRun()` and awaits it in the same request before
redirecting — the same choice Phase 6 made for `@mention` fan-out, just extended to a whole run
instead of one message. `maxTurns` defaults are kept modest (6) specifically so a run finishes
within a normal request lifetime. **Revisit with a real worker if**: runs commonly need more than
~6-10 turns, or step latency makes requests time out in practice.

## New tables (`src/modules/crews/schema.ts`)

`crews`, `crew_members`, `crew_runs`, `crew_run_steps` — migration `0012_crews.sql`, four new
tables, nothing existing touched. `crew_runs.conversationId` FKs into Phase 6's `conversations`;
`crew_run_steps.conversationMessageId` FKs into `conversation_messages` — a step's audit-trail row
and its actual chat message are two different tables for two different concerns (run bookkeeping
vs. the message itself), linked, not merged.

## Realtime and UI reuse

`/crews/runs/[id]` (`src/app/(app)/crews/runs/[id]/page.tsx`) reuses Phase 6's `<RoomLive>`
component and its `/api/rooms/[id]/stream` SSE endpoint **unmodified** — that route only ever
checks `conversation_participants` (via `assertParticipant`), never group-chat's own
`moduleTeam.enabled` flag, so a team can have `crews` enabled without `group-chat` and the run page
still gets live updates. Since runs currently execute fully before the page ever renders (no
background worker yet), the live-update path is effectively inert today — kept in place
deliberately, ready for the day `executeCrewRun` moves off the request thread.

## What's built vs. deliberately deferred

| Built | Deferred |
|---|---|
| Sequential / parallel / supervisor modes | `graph` mode (arbitrary DAG) |
| Hard budget + turn caps, per-crew | Distributed/retry-capable background workers |
| Optional stop-phrase early exit | A rules engine for stop conditions (beyond substring match) |
| Full audit trail (`crew_run_steps`) | A dedicated crew-run dashboard/analytics view |
| Crew CRUD + run-trigger UI (`/crews`) | Editing a crew's members/order after creation (delete + recreate today) |
| Realtime plumbing reused from Phase 6 | Actually observing a run mid-flight (moot until backgrounded) |

## Verifying it

End-to-end against production, using real data: created a real 2-member sequential crew, a pinned
`crew_run` conversation with real participants, ran two real `generateText()` steps (billed 2 real
credits total against the platform wallet), recorded both `crew_run_steps` rows, finalized the run
as `completed`/`sequential_complete`, checked the budget/turn-cap comparisons against the real
final row (both correctly `false`, well under the 50-credit/6-turn caps), then deleted all test
data — confirmed zero residue (same methodology as Phase 6: `src/modules/crews/runner.ts` imports
`server-only`-guarded modules, so the verification script exercises the same real Postgres/OpenAI
calls directly rather than importing the guarded file — see the file for why).

`npm run typecheck`/`npm run build` clean; `npm run modules:verify` — 6 modules registered, all
dependencies resolve; `npm run modules:sync` — crews inserted into the DB mirror; `/crews` and
`/crews/[id]`/`/crews/runs/[id]` all present in the build output. `/crews` correctly redirects
signed-out visitors (added to `auth.config.ts`'s middleware path list alongside `/rooms`, same fix
Phase 6 needed) and 404s if the module is disabled for the team.

## What's next

Phase 8 (data portability) can treat a crew and its runs as ordinary exportable entities — nothing
here needs redaction the way a marketplace-purchased persona's `systemPrompt` will (Phase 9);
`crew_run_steps` is already the audit trail a `usage/usage.csv` export would want.
