# Module Architecture

Shipped 2026-08-06, phase 0 of the "AI Bot Marketplace UK" concept integration
(`/root/.claude/plans/witaj-zapoznaj-sie-quirky-stream.md`). This is the foundational convention
every later feature module (group chat, Crews, data portability, marketplace) is built on — read
this before adding one.

There is no Laravel-style installable-package ecosystem in Next.js/App Router. This is a
from-scratch design for this stack, not a port of the mined concept doc's PHP module system.

## Where module code lives

`src/modules/<key>/` — not a separate top-level directory, not a monorepo package. One
`tsconfig.json`, one deploy target (a single `releases/<timestamp>/` built by `next build`); a
workspace tool would add real operational surface for no benefit here. **Core** capabilities
(teams, and later the model registry, persona versioning, credits/billing) are *not* required to
live under `src/modules/` — their code stays directly in `src/db/schema.ts`/`src/lib/**`, since
they're load-bearing for every request, not optional. Only `type: 'feature'` modules physically
live under `src/modules/<key>/` (first one: group-chat, Phase 6).

## The registry — static, not filesystem-scanned

`src/lib/modules/registry.ts` exports `MODULES: ModuleManifest[]` — an explicit array of imports,
not a directory scan. Next.js's build model (everything compiled ahead of time into `.next/`)
makes runtime directory scanning both harder and pointless here — nothing would appear there that
wasn't already compiled in. `src/lib/modules/types.ts` defines the manifest shape
(`key`/`requires`/`provides`/`permissions`/`navigation`/`isCore`).

`scripts/verify-module-graph.ts` (`npm run modules:verify`) checks every `requires.modules` entry
resolves to a registered key, failing loudly otherwise. This is the build-time substitute for the
concept doc's runtime `blocked` module state — App Router has no boot-time plugin loader to
produce that state from, so the check moves earlier, to build/CI time, at the cost of not being
able to show "blocked, here's why" live in the admin panel the way a runtime loader could. The
DB-backed `modules.status` mirror (Phase 2) partially recovers that by giving admin *something*
queryable, even though the check itself already happened earlier.

## Per-team enable/disable (DB-backed, lands in Phase 2)

`modules` table mirrors each manifest (seeded from `MODULES`, not user-editable — a queryable copy
for the admin UI and for `moduleTeam` FKs to point at). `moduleTeam` (moduleId, teamId, enabled,
settings jsonb) is the actual per-team switch. `isCore` entries are always enabled and have no
`moduleTeam` row.

## Routes: no runtime registration

App Router has no mechanism for a module to mount itself into the router at runtime (unlike
Laravel's `routes/web.php`). A feature module's pages are ordinary committed files under
`src/app/(app)/<feature>/...` that call an `assertModuleEnabled(teamId, '<key>')` guard (added
when the first feature module ships, Phase 6); the manifest's `navigation` entries just point at
these fixed `href`s for nav-building. **This is the single largest, deliberately-accepted
structural gap vs. the Laravel vision** — "installing" a module here is always a source change +
deploy, never a runtime upload.

## Deviation from the original plan, logged here rather than silently dropped

The plan (see the plan file, section 0.5) called for an ESLint import-boundaries rule forbidding
`src/modules/*/**` from importing another module except via its `index.ts` barrel. **Not added in
this phase** — this repo has no ESLint config or `lint` script at all (`package.json` has no
`"lint"` entry; the mined concept doc's `biome.json` lives only in the unrelated dead-legacy tree
at the repo root, not in the live release). Introducing a whole new lint toolchain purely to
enforce a convention with zero real feature modules yet is premature infrastructure, and adding
dependencies without being asked is against this project's own established norm (see
`CLAUDE.md`-equivalent guidance in the mined concept doc, which the user's working style otherwise
matches). **Revisit when Phase 6 (group-chat) ships the first real feature module** — at that
point there's an actual boundary worth enforcing mechanically, and it's a decision to raise with
the user (new dev dependency) rather than make unilaterally.

Until then, the boundary is enforced by convention only: a module's `index.ts` is the only file
other code may import from it, and this is a review-time discipline, not a build-time one.

## Registered so far

| Key | Type | Code lives at | Provides |
|---|---|---|---|
| `teams` | core | `src/db/schema.ts`, `src/lib/teams.ts`, `src/lib/auth*.ts` | `teams.workspace`, `teams.membership` |

Every phase from here on adds or updates an entry in `src/lib/modules/registry.ts` **and** a
section in this doc (or a new numbered doc, indexed from `00-overview.md`) in the same change —
see the mandatory rule noted at the top of the plan going forward.
