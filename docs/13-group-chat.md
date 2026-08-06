# Group Chat — Rooms

Shipped 2026-08-06, phase 6 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). **The first real `type: 'feature'`
module** — the first thing built under `src/modules/`, the first real exercise of
`08-module-architecture.md`'s conventions, and the first module a team can actually toggle on/off
via `/dashboard/team` (`09-team-authorization.md`'s module list had nothing to show until now).

## The core idea, unchanged from the concept doc

A persona is a `conversation_participant` **exactly like a human** — same table, same row shape.
That one modeling choice is why "group chat with bots" needed no separate code path: adding a
persona to a room is the same `conversation_participants` insert as adding a teammate, just with
`participantType: 'persona'`.

## New tables (`src/modules/group-chat/schema.ts`)

`conversations`, `conversation_participants`, `conversation_messages`, `message_reactions` —
**a new, parallel table family, not a migration of `chats`/`messages`.** Migrating the single most
heavily-used live table for modeling purity, with no rollback tooling available, wasn't worth it;
the cost is two parallel code paths (direct 1:1 chat vs. rooms), which is fine. Circular import
between this file and `src/db/schema.ts` (this file needs `teams`/`users`/`personaVersions`; the
core file re-exports this module's tables via `export * from '@/modules/group-chat/schema'`)
resolves cleanly — confirmed by `tsc`/`next build` — because Drizzle's `.references(() => …)` is
a lazy closure specifically so cross-file/circular table references work, same mechanism already
used for same-file pairs like `teams`↔`users` (Phase 1).

## A real concurrency bug, caught before it shipped

The first draft computed each message's `position` via `SELECT count(*) ...` before inserting —
correct for direct 1:1 chat (one writer per chat) but **racy for rooms**, where one
`@all-personas` message fires several persona turns that write concurrently. Two turns reading the
same count would both compute the same position, colliding. Fixed with an atomic
`UPDATE conversations SET message_count = message_count + 1 RETURNING message_count`
(`reserveNextPosition()`, `src/modules/group-chat/mentions.ts`) — Postgres's own row lock
serialises concurrent callers, so this is race-free without an explicit `FOR UPDATE` or advisory
lock. Verified directly: 5 concurrent reservations against a real conversation row produced exactly
`[1,2,3,4,5]`, no collisions. The same bug existed in `costTotal`/`tokenTotal` (a plain `SET` that
would have had the last writer clobber the others instead of accumulating) — fixed with atomic
`+=` via `sql\`${column} + ${amount}\`` instead.

## Deliberate simplification: non-streaming room replies

Direct 1:1 chat (`src/app/api/chat/route.ts`) streams tokens as they arrive. Room replies use
`generateText` (not `streamText`) — a persona's message appears whole once generated, not
token-by-token. Reasons: (1) a room can have several personas replying to one message in parallel,
and multiplexing N token streams over one connection is real complexity with no clear UX win over
"typing… then the full message" for a multi-party thread; (2) it makes the realtime layer trivial
— broadcast "a message was created," let clients fetch it, rather than relaying partial-token
deltas over SSE. `postMessageAction` (`src/modules/group-chat/actions.ts`) **waits for every
mentioned persona's reply before returning** — acceptable for a v1 with up to 5 parallel personas,
revisit if that latency proves to matter.

## Mention routing (`src/modules/group-chat/mentions.ts`)

`parseMentions()` extracts `@handle` tokens (`@all-personas`/`@all` mentions every non-departed
persona participant, capped at `maxPersonasPerRoom`, default 5 — `manifest.settingsSchema`).
**Personas never auto-reply to personas** — enforced structurally, not by a runtime check:
`postMessageAction` is the only caller of `parseMentions`/`runMentionedTurns`, and it only runs for
user-authored messages (persona-authored messages never re-trigger routing). True bot-to-bot
orchestration is Crews' job (Phase 7), by design.

`runPersonaTurn()` reuses `buildSystemPrompt()`/`getModel()`/`costForTokens()`/`spendCredits()`/
`hasActiveEntitlement()` **exactly as** the direct-chat path and Phase 5's billing overhaul —
none of that logic was duplicated. Room history is passed to the model with speaker labels
(`[handle] message`) so a persona knows who said what in a multi-party thread — plain
user/assistant roles can't carry that on their own.

## Realtime: Postgres LISTEN/NOTIFY + SSE, not a hosted pub/sub

`src/modules/group-chat/realtime.ts` — `notifyConversation()` fires `pg_notify` on the existing
pooled connection (any connection can `NOTIFY`); `listenToConversation()` opens a **dedicated**
connection per SSE stream (LISTEN needs one held open for the connection's lifetime — never the
pooled `db` client) and closes it when the client disconnects
(`/api/rooms/[id]/stream/route.ts`'s `request.signal` abort handler). Zero new hosted dependency,
fits pm2's long-running-process model. Verified directly: a real `pg_notify` → `LISTEN` round trip
across two independent connections delivered the payload correctly. The client side
(`RoomLive`, a client component) is deliberately simple — on any event, `router.refresh()` re-fetches
the server-rendered message list rather than diffing/appending client-side, proportionate to a
non-streaming, non-optimistic UI.

## What's built vs. deliberately deferred

| Built | Deferred (schema-ready or noted, not implemented) |
|---|---|
| Rooms, multi-person + multi-persona | Folders |
| `@mention` routing, `@all-personas`, parallel turns | Side-by-side model comparison |
| Real-time via SSE | Prompt library |
| Billing reuse (credits + pass coverage) | MD/PDF/DOCX export |
| Add persona / add teammate to an existing room | Message comments (margin annotations) |
| `message_reactions` table | Reactions UI (table exists, no endpoint/UI yet) |
| `parentId`/`threadRootId` columns on messages | Thread branching UI |
| Per-team module toggle (`/dashboard/team`) | `conversation_shares` (link sharing) — `chats.isShared` pattern exists to extend later |

## Verifying it

Migration `0011_group_chat.sql` — four new tables, nothing existing touched. End-to-end
verification against production, using real data and a **real OpenAI API call** (not mocked —
this is the riskiest, most novel part of the phase, worth the ~2 credits it cost to actually prove):
created a real room with a real persona participant, fired 5 concurrent atomic position
reservations (no collisions), parsed a real `@mention`, ran a real `pg_notify`/`LISTEN` round trip,
called `generateText` for real (`"acknowledged"` came back, billed 1 credit correctly against the
team wallet), then deleted all test data — confirmed zero residue. One test run crashed mid-way
during debugging (a missing explicit UUID for a raw-SQL insert — Drizzle's `$defaultFn` only
applies through the query builder, not raw SQL) and left one orphaned test room + 2 real credit
debits from genuine API calls; the room was manually deleted, the credit transactions were **kept**
as an honest historical record (append-only ledger — never delete real spend, even test spend).

Also fixed during verification: `/rooms` returned a 500 (uncaught `UNAUTHENTICATED`) instead of
redirecting to login for signed-out visitors, because it wasn't in `auth.config.ts`'s middleware
path list the way `/dashboard` is — `/chat` doesn't need this (it supports guests via
`guestToken()`), but rooms have no guest mode. Fixed and reverified (307 redirect, not 500).

`npm run typecheck`/`npm run build` clean; `npm run modules:verify` confirms all 5 registered
modules' dependencies resolve; `/rooms` correctly 404s if the module is disabled for the team,
redirects to login if signed out.

## What's next

Phase 7 (Crews — bot-to-bot orchestration) reuses this phase's `conversations` table
(`kind: 'crew_run'`) and `runPersonaTurn()` directly — a crew member's turn is the same function
call, just triggered by an orchestrator instead of a human's `@mention`.
