# Team Authorization & Module Toggles

Shipped 2026-08-06, phase 2 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). Builds on `07-teams.md` (teams exist)
and `08-module-architecture.md` (the module registry convention).

## Three authorization levels

1. **Platform** — `users.isAdmin` + `requireAdmin()` (`src/lib/auth.ts`), unchanged since before
   teams existed. Gates `/admin`, which still manages the whole platform, not one team.
2. **Team** — new this phase. `requireTeamMember(teamId)` / `requireTeamRole(teamId, roles)` /
   `requireTeamPermission(teamId, permission)` in `src/lib/auth.ts`. A platform admin is **not**
   automatically a team member anywhere except their own platform team — these are independent
   checks, not a hierarchy where platform admin implies team access.
3. **Resource** — unchanged (`assertChatAccess()` in `src/server/actions/chat.ts` — see "What was
   deliberately NOT changed" below).

## Permissions

`src/lib/permissions.ts` — `TEAM_PERMISSIONS` (a short, hand-maintained list: `manage_members`,
`manage_invitations`, `manage_modules`, `view_billing`, `manage_billing`, `transfer_ownership`) and
`hasPermission(member, permission)`. A role is a **preset**, not a wall: `team_members.permissions`
(jsonb string array) can grant a member extra permissions beyond their role's defaults, matching
the concept doc's own "role to preset, not a hard wall" design. `owner` always passes every check.

Only `manage_members`, `manage_invitations`, and `manage_modules` have real consumers so far
(`src/server/actions/team.ts`) — `view_billing`/`manage_billing`/`transfer_ownership` are declared
for Phase 5 (billing overhaul) and not wired to anything yet. Declaring them now, unused, is a
deliberate exception to "don't build ahead of need" — the whole point of a permission *string* list
is that adding a new check later never requires a migration, but the list itself doubles as the
place newcomers look to see what's plannable; three inert entries is cheap, a whole extra table
migration later would not be.

## `modules` / `module_team` — DB half of the module architecture

`modules` mirrors `src/lib/modules/registry.ts`'s `MODULES` array — write path is exclusively
`syncModuleRegistry()` (`src/lib/modules/sync.ts`), run via `npm run modules:sync`
(`scripts/sync-modules.ts`) after any registry change. Not wired into the build or deploy
automatically yet — deliberately manual for now (see `06-operations.md`'s existing "no queue/cron
infra" pragmatism; this is the same call). `module_team` is the actual per-team on/off switch;
`isModuleEnabledForTeam()`/`listModulesForTeam()` (`src/lib/modules/db.ts`) are the read side.
**Feature modules default OFF** (no `module_team` row = disabled) until a team turns them on — core
modules have no row at all and are always on. There are currently zero `type: 'feature'` modules
registered (only `teams`, `type: 'core'`), so the team-settings module list has nothing to toggle
yet — that's expected, not a bug; it'll show something real starting Phase 6 (group-chat).

## `/dashboard/team` and `/invite/[token]`

New pages. A team's members, pending invitations, and (once any exist) feature-module toggles.
Operates on the signed-in user's **own** `defaultTeamId` — there is no team switcher yet, so a user
who's a member of a second team (via an accepted invite) can't currently view/manage that team
through this UI, only through direct DB access. Flagged as a known gap, not silently left
undiscoverable: `users.defaultTeamId`/session plumbing (`src/types/next-auth.d.ts`,
`src/lib/auth.config.ts`) was added this phase specifically so a team switcher is a small follow-up
(swap which team the session points at) rather than new infrastructure, whenever it's needed.

**No email-sending infrastructure exists in this app** (checked: no provider dependency anywhere in
`package.json`). `inviteMemberAction` creates the `team_invitations` row and returns the invite
link directly in the UI for the inviter to copy and send manually, rather than pretending to email
it. `/invite/[token]` validates the token (invalid / already used / expired / wrong email) and, for
a signed-in user whose email matches, accepts via `acceptInvitationAction`.

## What was deliberately NOT changed: chat privacy

The plan flagged `assertChatAccess()` gaining an "optional `chat.view_team` permission for genuine
multi-member teams later" as a *later*, optional step — **not done in this phase**, on purpose.
`chats` are still strictly private to the individual who started them (owner-or-guest-token match,
exactly as before teams existed), even within a multi-member team. Broadening this without an
explicit per-chat visibility flag (parallel to `personas.visibility`) would let e.g. a newly-added
team admin suddenly read another member's existing private conversation transcripts — a real
privacy regression, not a neutral capability add. If/when shared team visibility into direct chats
is wanted, it needs its own explicit opt-in on `chats` (or waits for Phase 6's `conversations`,
which *is* explicitly multi-participant by design), not a silent broadening of today's `chats`
table's access rule.

## Verifying it

```sql
select key, is_core, status from modules;                 -- mirrors MODULES registry
select module_id, team_id, enabled from module_team;       -- per-team toggles (empty until Phase 6)
select team_id, action, target_type, target_id from activity_log
  where team_id is not null order by created_at desc limit 10;
```
Confirmed against production: the `teams` core module registered correctly, zero `module_team` rows
(expected — no feature modules yet), `/dashboard/team` and `/invite/[token]` both build and respond
correctly (redirect-to-login for `/dashboard/team` when signed out, 200 with a validation message
for an invalid invite token).

## What's next

Phase 3 (DB-backed AI model registry) is next — core infrastructure, not a `src/modules/` feature
module, same as `teams`. Phase 6 (group-chat) will be the first `type: 'feature'` module, and the
first real exercise of the `module_team` toggle built here.
