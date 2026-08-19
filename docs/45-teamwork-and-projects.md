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
