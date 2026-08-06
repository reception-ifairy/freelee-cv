# Teams / Workspaces

Shipped 2026-08-06, phase 1 of the "AI Bot Marketplace UK" concept integration (mined for ideas
from `/var/www/freelee.cv/uploads/ai-bot-marketplace-uk.zip` — a from-scratch Laravel/PHP concept
doc, unrelated in stack; only the ideas were ported, not code). Full roadmap:
`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`.

**This supersedes `01-database.md`'s "No multi-tenancy — this is a single-organization app"
line** — that was true before this phase and is not anymore. See that doc's table map entry for
`teams`/`team_members`/`team_invitations` for the column-level detail; this page covers the model
and the migration itself.

## Model

Every user has exactly one **personal team** — "a workspace of one," not a special case. The
pre-existing single owner's team is the **platform team** (`teams.slug = 'platform'`), which owns
all 147 pre-existing personas. Multi-member teams are just personal teams that gained a second
member; nothing branches on "is this a solo user or an organisation."

```
users.defaultTeamId ──> teams.id          (every user's active team; NOT NULL)
teams.ownerId ──> users.id                (every team has exactly one owner)
team_members (teamId, userId, role)       (owner | admin | member | guest — see schema.ts)
personas.teamId ──> teams.id              (ownership — who can edit)
personas.visibility                        (private | team | unlisted | public — who can browse/chat;
                                             independent of teamId, all 147 pre-teams personas are
                                             `public` so the catalog is unaffected)
chats.teamId, orders.teamId,
credit_ledger.teamId                       (attribution; guest chats fall back to the platform team)
```

`users.isAdmin` is unchanged and unrelated — it means **platform admin** (`/admin` access), not a
team role. `/admin` still manages the whole platform, not one team; per-team surfaces are Phase 2.

## The circular FK, and why registration works in one transaction

`teams.ownerId` requires the user to exist; `users.defaultTeamId` requires the team to exist. A
brand-new signup needs both created together. This is only possible because both FKs are
`DEFERRABLE INITIALLY DEFERRED` (`drizzle/0006_teams_not_null.sql`) — Postgres checks deferred
constraints at `COMMIT`, not per-statement, so `registerAction` (`src/server/actions/auth.ts`) can
insert the user row (referencing a not-yet-existing team) and the team row (referencing that user)
in either order inside one transaction, and both checks pass once the transaction commits with
both rows present. `src/db/seed.ts`'s `upsertSeedUser()` uses the identical pattern.

## Migration path (for the next person retrofitting a NOT NULL FK onto a live table)

Two-step, additive-then-tighten, per this repo's existing "split risky changes" operations rule:

1. `drizzle/0005_teams_foundation.sql` — new tables + every `teamId`/`defaultTeamId` column added
   **nullable**. No app code reads them yet.
2. Backfill (scratchpad SQL, snapshot-first via `pg_dump --data-only`, wrapped in
   `BEGIN`/idempotent `UPDATE`s/a `RAISE EXCEPTION` assertion block before `COMMIT` — see
   `06-operations.md`'s backfill pattern) — creates the platform + personal teams, populates every
   `teamId`/`defaultTeamId` row, asserts zero NULLs remain before committing.
3. `drizzle/0006_teams_not_null.sql` — only run after step 2's assertion passed in production:
   flips the columns `NOT NULL`, and makes the `teams`↔`users` FK pair deferrable.
4. Only then does application code start supplying `teamId` on every insert (`registerAction`,
   `startChatAction`, `grantCredits`/`spendCredits`, `createOrder`, the admin persona-save action)
   — verified via `npx tsc --noEmit`, which fails loudly on any insert missing a newly-required
   column.

## What's deliberately NOT scoped by team

`categories`, `sectors` (UK taxonomy — platform-wide, shared), `posts`, `pages`, `menuItems`,
`settings`, `themes` — single-tenant CMS/taxonomy by design. Scoping these would be unrequested
churn; nothing about teams changes their meaning.

## Verifying it

```sql
select id, name, slug, owner_id, plan_key from teams;
select team_id, user_id, role from team_members;
select count(*) filter (where team_id is null) as null_team, count(*) as total from personas;
```
All should show zero NULLs post-backfill. The deferred-FK insert pattern itself was verified with
a throwaway transaction that inserts, cross-checks, then deliberately rolls back — no persisted
test data (see the Phase 1 completion notes in the plan file above for the exact script).

## What's next

Phase 2 adds team-scoped authorization (`requireTeamRole`/`requireTeamPermission`), a real
team-settings surface (`/dashboard/team`), and the `modules`/`moduleTeam` tables that per-team
module enable/disable (Phase 0's module architecture) depends on.
