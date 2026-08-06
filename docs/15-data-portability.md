# Data Portability

Shipped 2026-08-06, phase 8 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). Core, always-on — not a
team-disableable `type: 'feature'` module, the same reasoning as the AI model registry: export/
import is platform infrastructure, and the plan called it out explicitly as "GDPR-adjacent
baseline, not an optional product surface."

## The core idea

`src/lib/portability/` has three layers, each a near-direct translation of the mined concept
doc's PHP interfaces: `Exporter`/`Importer` (one per entity, `src/lib/portability/exporters.ts` /
`importers.ts`), a static registration array for each (same static-registry philosophy as
`src/lib/modules/registry.ts` — no filesystem scanning), and an orchestrator (`bundle.ts` for
export, `import.ts` for import) that runs them in order and assembles the result.

## One deliberate shape change: a single JSON document, not a zip

The concept doc's `.aibmpkg` bundle is a zip of separate JSON files plus a `usage/usage.csv`.
Built here as **one JSON document** instead — `{ manifest, entities: { personas: [...], ... },
usageCsv: "..." }`. No zip/tar library was already a dependency of this app, and adding one purely
for packaging (the substance — structured, checksummed, per-entity, redaction-aware data — is
identical either way) wasn't worth it for a v1. Revisit if a real need for a literal downloadable
`.zip` shows up.

## `contracts.ts` runs in two worlds on purpose

Every other server-side lib file in this app starts with `import 'server-only'`. This one
deliberately doesn't — `src/lib/portability/**` has to work both inside a Next.js server action/
route (the self-service export button) **and** inside a plain `tsx` script that never boots
Next.js at all (`scripts/export-bundle.ts`, `scripts/import-bundle.ts`). The fix is dependency
injection: every function takes its Drizzle client as a parameter (`PortabilityDb`, a type-only
import so it carries no runtime dependency on the guarded `@/db` singleton) instead of importing
`@/db` directly. A Next.js caller passes the real pooled `@/db`; a script builds its own raw client
the same way `src/db/seed.ts` always has. This is also why Phase 8's own verification script could
import `buildExportBundle`/`importBundle` directly — the first phase where that's been possible;
Phase 6 and 7's verification scripts both had to re-implement pieces of the real logic in raw SQL
specifically to route around this same guard on files that *do* need it.

## Manifest, checksum, and the redaction hook

`ExportManifest` — `kind`, `version`, `generatedAt`, `contents` (row count per entity),
`redactions`, `requires: { models, modules }`, and `checksum` (sha256 over the `entities` object
only, with keys canonicalised/sorted first — deliberately **excludes** `generatedAt`, so re-
exporting unchanged data twice in a row produces an identical checksum; verified directly, see
below). `persona_versions.system_prompt` is redacted (`null` + `instructionsRedacted: true`)
whenever the exporting team isn't the version's authoring team (`exporters.ts`'s
`redactSystemPrompt()`) — structurally unreachable today, since every persona this exporter sees
is already filtered to the exporting team's own catalog and there's no cross-team persona
"install" mechanism yet. Written as a real, always-evaluated check rather than a TODO specifically
so it's already correct the day Phase 9's marketplace introduces installed personas whose
authoring team differs from the installing team.

## Scoped down: 11 entities exported, only 4 importable

Exported: `team`, `personas`, `personaVersions`, `crews`, `crewMembers`, `conversations` +
`conversationParticipants` + `conversationMessages` (Phase 6/7's tables), `chats` + `messages`
(the original direct 1:1 chat history), and `usageEvents` (rendered into `usageCsv` too). That's
every table a team's data actually lives in.

**Only `personas`, `personaVersions`, `crews`, and `crewMembers` are importable.** Two different
reasons for the cuts:

- **Conversations/chats and their messages are export-only.** They're historical transcripts, not
  "install this capability" data the way a persona or crew definition is. Correctly remapping
  `conversation_participants.participantId` (polymorphic — points at either a user or a persona
  depending on `participantType`) for comparatively low incremental value wasn't worth it for a
  v1. A team can still get its full transcript history out (real GDPR/backup value); it just can't
  be re-imported yet. Revisit if a real disaster-recovery or cross-instance migration need shows
  up.
- **`usageEvents` is excluded on different grounds — not scope, principle.** It's the real-money-
  adjacent billing/audit trail. Allowing it to be *imported* would let a bundle fabricate "this
  team was charged N credits" history into a live ledger with no corresponding real spend behind
  it. Export-only, permanently, not just for v1.

## Idempotent import via `externalIdMap`

One new table (`external_id_map`, migration `0013_data_portability.sql`): `(teamId, entityType,
externalId) -> localId`, unique on the first three. Every importer checks it before writing; every
successful insert records into it. Re-importing the same bundle a second time therefore skips
everything instead of duplicating rows — verified directly (see below).

**A real bug caught by writing the dry-run verification, not by inspection**: the first version
only checked `externalIdMap` (a real DB row) to resolve an FK. That's correct for a real import,
but a **dry run never writes**, so `personasImporter`'s dry-run branch never created a mapping row
— meaning `personaVersionsImporter`, running immediately after in the same dry run, could never
resolve its owning persona's local id and reported every single version as "skipped" (indistinguishable
from "already imported"), even on a completely fresh import. Fixed with `ImportOpts.dryRunSeen`
(`contracts.ts`) — an in-memory `Map<EntityKey, Set<externalId>>`, allocated only for a dry run,
that each importer's dry-run branch marks and every importer's FK resolution checks as a fallback
before hitting the DB. This is exactly the kind of bug the "verify before reporting done" habit
this whole integration has followed is for — see the Verifying section for the before/after.

## Persona linking reuses Phase 4's own pattern

Personas are inserted with `currentVersionId`/`draftVersionId` left `null`, then
`linkPersonaVersionPointers()` updates them once `personaVersions` has been imported and has local
ids — the identical "nullable pointer, linked after" shape `docs/11-persona-versioning.md` already
uses for every persona-creation path in this app, reused here rather than invented fresh.

## Entry points

- **Self-service**: `/dashboard/team/export` (`src/app/(app)/dashboard/team/export/route.ts`) — a
  new `team.export_data` permission (`src/lib/permissions.ts`, granted to `owner`/`admin` by
  default), a download button on `/dashboard/team`. Available to any team, not just platform
  admins — the plan's own "GDPR-adjacent baseline" framing was about every team's right to their
  data, not a support-tooling feature for platform staff, so this shipped as team self-service
  rather than the `/admin`-only button the plan sketched.
- **Power-user / scriptable**: `npx tsx scripts/export-bundle.ts --team=<id> [--out=path.json]`
  and `npx tsx scripts/import-bundle.ts --team=<id> --bundle=path.json [--apply]` — matches this
  repo's documented `npx tsx` scratch-script convention. Import defaults to a dry run; `--apply`
  is required to actually write, and even then runs inside one transaction (all or nothing).

## Adapters: only `generic-json`, `chatgpt-export` deferred

`SourceAdapter` (contracts.ts) exists as an interface for normalising a foreign bundle format into
this app's own `ExportBundle` shape before import. Only `generic-json` — this app's own format,
round-tripped — is implemented. `chatgpt-export` (parsing OpenAI's own conversation export format)
was in the plan's realistic-MVP list but is deferred here: there's no real sample of that format
available to verify an importer against in this environment, and shipping an adapter that's never
been exercised against real data was judged worse than being explicit that it doesn't exist yet.

## Verifying it

Migration `0013_data_portability.sql` — one new table, nothing existing touched.
`npm run typecheck`/`npm run build` clean; `npm run modules:verify` — 7 modules registered, all
dependencies resolve; `/dashboard/team/export` present in the build output and correctly redirects
signed-out visitors.

Full round-trip against production, importing the real shipped code directly (not a re-
implementation, per the note above): exported the platform team's real 147 personas + 147 versions
twice in a row with no changes in between — identical checksum both times. Created a fresh scratch
team (importing into a *different* team is the actual portability test — importing back into the
team that still has the originals would just collide on `slug`, which is a real global-unique
index). Dry run against the scratch team correctly reported `147 would-insert` for both personas
and their versions (this is the run that caught and proved the `dryRunSeen` fix above — before the
fix it reported personas correctly but personaVersions as 100% skipped). Applied for real — 147
personas and 147 versions inserted, all 147 personas correctly linked to their `currentVersionId`
afterward (spot-checked one: persona's `currentVersionId` points at a version whose own
`personaId` correctly points back). Re-ran the exact same import a second time — 0 inserted, all
147 skipped as already-imported, row count unchanged — no duplicates. Deleted the scratch team and
everything imported into it — confirmed zero residue.

## What's next

Phase 9 (marketplace, if it happens) is the first real consumer of the redaction hook already
built into `personaVersionsExporter` — an installed (not authored) persona's `systemPrompt` will
finally hit the `authoringTeamId !== exportingTeamId` branch that's been correct-but-unreachable
since this phase shipped.
