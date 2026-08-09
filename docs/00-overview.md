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

**Simplified 2026-08-06**: this app used to live at
`/var/www/freelee.cv/releases/2026-08-02T10-02-09-000Z/`, a leftover timestamped-release path from
when the project briefly used a Capistrano-style `releases/<timestamp>/` convention — abandoned in
practice (new work always landed in the one existing folder, nothing ever rotated), so the nesting
was pure ceremony. It now lives directly at `/var/www/freelee.cv/app/` — moved with `mv` (git
history intact), `ecosystem.config.cjs` updated, pm2 process deleted and re-started against the new
path (a plain `pm2 restart` does not pick up a changed `cwd`; re-registering is required). The old
`app/`, `lib/`, `db/`, `components/` dead-legacy tree that previously sat at this same root level
(see below) was deleted the same day, so the `app/` name was free to reuse for the real thing.

Always confirm with `pm2 describe aigency-freelee | grep "exec cwd"` before editing — other
near-identical copies of this codebase still exist elsewhere on the server:

| Path | Status |
|---|---|
| `/var/www/freelee.cv/app/` | ✅ **canonical, live** — nginx → port 3015 → pm2 `aigency-freelee`. Edit here. |
| `/var/www/demo.ifairy.co.uk/releases/2026-08-02T10-02-09-000Z/` | ⚠️ stale mirror — same skeleton, **out of sync** with production (frozen before this project's phases 1–9). Left as-is (2026-08-06 decision) — contains real secrets in plaintext (`.deploy-db.json`/`.deploy-env.json`), handle with care if ever touched. pm2 `demo-aigency-next`, port 3033. |
| `/var/www/dev.freelee.cv`, `sandbox.freelee.cv`, `test.freelee.cv`, `demo.freelee.cv` (vhost) | 🗄 archived 2026-08-03 to `/var/backups/freelee-legacy-archive/` via `scripts/archive-legacy-domain-deployments.sh` — `mv`, not `rm`, fully reversible. |
| `/var/www/demo.freelee.cv/` (a separate orphaned Next.js install, no nginx/pm2 pointing at it) | 🗑 permanently deleted 2026-08-06 — confirmed dead first. |

Full detail and rationale for each row lives in the project root `README.md` (kept as the
single up-to-date source of truth on deployment state, since it's outside this app's own directory
and survives redeploys). This codebase is also on GitHub (public):
https://github.com/reception-ifairy/freelee-cv.

## How releases work

`ecosystem.config.cjs` (project root, one level above this app — i.e.
`/var/www/freelee.cv/ecosystem.config.cjs`) points pm2's `aigency-freelee` process at
`RELEASE_DIR`, now simply `app` (`path.join(__dirname, 'app')`). To ship a change:

```bash
cd /var/www/freelee.cv/app
npm run typecheck
npm run build
pm2 restart aigency-freelee
```

A plain `pm2 restart` is fine for a normal deploy — it only fails to pick up config changes like a
different `cwd`, which is a rare, deliberate operation (re-register with `pm2 delete aigency-freelee
&& pm2 start ecosystem.config.cjs` from `/var/www/freelee.cv/` when that's actually needed).

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
- **Translations** (admin-controlled global site language — English source + Polish, DB-backed, `/admin/translations` panel with AI-driven "add a language" + export/import) — `17-translations.md`
- **Knowledge sources** (admin-manageable external RAG/search APIs personas can cite from, generic dot-path response mapping, replaces the hardcoded curriculum/universe integration) — `18-knowledge-sources.md`
- **Frontpage sections** (ordered, admin-editable homepage sections — reorder/hide/edit without a deploy, replaces a fixed hardcoded JSX sequence) — `19-frontpage-sections.md`
- **Branding** (`/admin/theme` rebuilt into a full theme CRUD list — logo, favicon, curated fonts, full color palette, multiple saved themes with one active) — `20-branding.md`
- **Image-generation engines** (catalog + admin config only — OpenAI/Stability image models, live "Fetch models" for every AI provider including chat, shared grid-picker UI components) — `21-image-engines.md`
- **Modular word bank & help tips** (translation module rebuilt around per-module banks + AI translation, scan-based extractor that can't go stale, side-by-side export, `?` help tips) — `22-modular-word-bank.md`
- **Chat layouts** (13 category/audience-adaptive chat UIs incl. group and narrative variants; narrative layouts restructure the model's output into narration/dialogue/choices) — `23-chat-layouts.md`
- **Conversation controls** (per-chat tone/writing/output/length + interaction style and how-it-handles-unknowns, without editing the persona) — `24-chat-controls.md`
- **Google (Gemini) provider** (full driver + live model fetch; the "listed ≠ usable" gotcha and why tiers point at `-latest` aliases) — `25-google-provider.md`
- **Vision, image generation, embedding, input filtering** (the last four unwired capability flags; includes the `public/` static-manifest trap and why uploads are served by a route) — `26-vision-and-images.md`
- **Integration candidates** (ranked shortlist of external APIs — ElevenLabs voice, search grounding, moderation, object storage — mapped to the seams that already exist) — `27-integration-candidates.md`
- **Local models & AI moderation** (Ollama/Llama on this box with real CPU throughput numbers; classifier-based input moderation and why OpenAI's free endpoint doesn't work here) — `28-local-models-and-moderation.md`
- **Handbook** (plain-language user guide for the admin panel, GitBook-style, at `/admin/handbook`) — see `handbook/` and `src/lib/handbook/toc.ts`
