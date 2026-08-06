# Freelee — Platform Overview

Freelee is a self-contained AI persona marketplace: a public site where visitors chat with
specialist AI personas, and an owner's admin console (`/admin`) built into the same Next.js app —
no external control plane. This page is the front door of the documentation; use the sidebar to move
between sections.

## What this app is

- **Public site**: landing page, persona directory, chat, pricing, blog, login/register, dashboard.
- **Admin console** (`/admin`): personas, categories, sectors, prompt modifiers, credit packs, sales,
  customers, blog posts, static pages, menus, settings, appearance/theme.
- **Chat runtime**: streams replies from OpenAI (default), Anthropic, OpenRouter, or Ollama, per
  persona, via the Vercel AI SDK.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Styling | Tailwind CSS 4 (CSS-first `@theme`), `@tailwindcss/typography` |
| Database | PostgreSQL, Drizzle ORM (SQL-first) |
| AI | Vercel AI SDK — OpenAI / Anthropic / OpenRouter / Ollama |
| Auth | Auth.js |
| Process manager | pm2 |
| Reverse proxy | nginx |

## Deployment topology — read this before editing anything

There are **several near-identical copies of this codebase on the server**. Only one is live.
Always confirm with `pm2 describe aigency-freelee | grep "exec cwd"` before editing.

| Path | Status |
|---|---|
| `/var/www/freelee.cv/releases/2026-08-02T10-02-09-000Z/` | ✅ **canonical, live** — nginx → port 3015 → pm2 `aigency-freelee`. Edit here. |
| `/var/www/freelee.cv/app`, `lib`, `db`, `components` (repo root, no `src/`) | ❌ dead legacy — different schema, was wired to a since-removed T1000 integration. Never deployed. |
| `/var/www/demo.ifairy.co.uk/releases/2026-08-02T10-02-09-000Z/` | ⚠️ stale mirror — same skeleton, **out of sync** with production. pm2 `demo-aigency-next`, port 3033. |
| `/var/www/dev.freelee.cv`, `sandbox.freelee.cv`, `test.freelee.cv`, `demo.freelee.cv` (vhost) | 🗄 archived 2026-08-03 to `/var/backups/freelee-legacy-archive/` via `scripts/archive-legacy-domain-deployments.sh` — `mv`, not `rm`, fully reversible. |

Full detail and rationale for each row lives in the project root `README.md` (kept as the
single up-to-date source of truth on deployment state, since it's outside any one release folder and
survives redeploys).

## How releases work

`ecosystem.config.cjs` (project root) points pm2's `aigency-freelee` process at one release
directory (`RELEASE_DIR`, currently `releases/2026-08-02T10-02-09-000Z`). To ship a change:

```bash
cd /var/www/freelee.cv/releases/2026-08-02T10-02-09-000Z
npm run typecheck
npm run build
pm2 restart aigency-freelee
```

There is currently only one release directory — new work is committed directly into it rather than
cutting a fresh timestamped folder each time. If a new release folder is ever introduced, update
`ecosystem.config.cjs`'s `RELEASE_DIR` and this doc's canonical-path table.

## Migrations — a real constraint, not a style choice

`drizzle-kit generate` / `push` / `migrate` all require an interactive TTY to resolve schema
conflicts and **hang indefinitely** in this non-interactive environment. The established pattern:

1. Edit `src/db/schema.ts`.
2. Hand-write the equivalent SQL as `drizzle/000N_description.sql` (sequential, one more than the
   highest existing file).
3. Apply directly: `psql -h localhost -U aigency_next -d aigency_freelee -f drizzle/000N_*.sql`.

`drizzle/meta/_journal.json` is **not fully in sync** with the applied migrations (entries exist only
for `0000`/`0001`; `0002`–`0004` were hand-applied and never registered). This is a known, accepted
gap — nothing in the real deploy path calls `drizzle-kit migrate`, so it doesn't block anything
functionally. Don't try to silently "fix" it by hand-crafting snapshot JSON; if it's ever worth
reconciling, do it deliberately with a TTY available to verify the result.

## Where to go next

- **Database & schema** — `01-database.md`
- **AI models** — `02-ai-models.md`
- **Admin panel** — `03-admin-panel.md`
- **Public site** — `04-public-site.md`
- **UK marketplace taxonomy** (categories, sectors, guardrails, audience segments) — `05-uk-taxonomy.md`
- **Operations** (deploy checklist, backups, domain hygiene) — `06-operations.md`
- **Teams / workspaces** (multi-tenancy retrofit, phase 1 of the marketplace-concept integration) — `07-teams.md`
- **Module architecture** (Next.js-native plugin convention, phase 0 of the marketplace-concept integration) — `08-module-architecture.md`
- **Team authorization & module toggles** (permissions, `/dashboard/team`, phase 2 of the marketplace-concept integration) — `09-team-authorization.md`
- **AI model registry** (DB-backed provider/model catalog, `/admin/ai-models`, phase 3 of the marketplace-concept integration) — `10-ai-model-registry.md`
- **Persona versioning** (identity/content split, draft-publish cycle, phase 4 of the marketplace-concept integration) — `11-persona-versioning.md`
- **Billing overhaul** (team wallets, subscriptions, time-boxed passes, phase 5 of the marketplace-concept integration) — `12-billing-overhaul.md`
- **Group chat / rooms** (multi-participant conversations, `@mention` persona routing, realtime via LISTEN/NOTIFY, phase 6 of the marketplace-concept integration) — `13-group-chat.md`
- **Crews** (bot-to-bot orchestration — sequential/parallel/supervisor modes, budget + turn caps, phase 7 of the marketplace-concept integration) — `14-crews.md`
- **Data portability** (export/import bundles, idempotent via externalIdMap, self-service + scriptable, phase 8 of the marketplace-concept integration) — `15-data-portability.md`
- **Marketplace** (external vendors, install-as-clone, credit-markup revenue share, phase 9 — optional, last — of the marketplace-concept integration) — `16-marketplace.md`
