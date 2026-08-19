# Freelee — Next.js

An AI persona marketplace: streaming chat, multi-tenant teams, a team-scoped credit wallet with
subscriptions and time-boxed passes, group chat rooms, bot-to-bot "crews" on a durable job queue,
projects that group the work, data export/import, an external-vendor marketplace, a block-builder
CMS, and a full admin panel.

📖 **[docs/CHANGELOG.md](docs/CHANGELOG.md) is the record of every update** — one numbered entry per
commit with the reason for the change, the doc that covers it, and the migration it applied. Start
there to find out what happened and when; `npm run changelog:verify` fails the build if a commit
has no entry.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Drizzle ORM ·
PostgreSQL · Auth.js v5 · AI SDK 7 · Tailwind CSS 4

---

## Quick start

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL, then:
npx auth secret          # writes AUTH_SECRET

# Apply every migration in order — NOT `npm run db:push`/`db:migrate`,
# both hang waiting for interactive input in this codebase's history of
# hand-edited schema changes. See DEPLOY.md for why.
for f in drizzle/000*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done

npm run db:seed              # platform team, admin/demo users, 8 demo personas, CMS
npm run db:seed-ai-models    # AI provider/model catalog
npm run modules:sync         # module registry mirror

npm run dev
```

Open <http://localhost:3000>.

| Account | Email | Password |
|---|---|---|
| Admin | `admin@freelee.cv` | `password` |
| Customer | `demo@freelee.cv` | `password` |

The admin panel is at `/admin`. **Change both passwords before exposing this to the internet.**

Working on this locally as a coworker (not deploying it)? See **`CONTRIBUTING.md`** — clone/setup,
getting realistic data via the export/import bundle system instead of production DB access, and
the PR workflow.

For a fully gated, verified install runbook (environment → schema → build → smoke test → deploy →
production checklist), see **`DEPLOY.md`**.

### Making the AI answer

Nothing generates until a provider key exists. Either set `OPENAI_API_KEY` in `.env.local`, or
sign in as admin and paste it under **Admin → Settings → AI**. Keys stored in the settings table
take precedence over the environment, so they can be rotated without a redeploy.

---

## Architecture

```
src/
├── app/
│   ├── (marketing)/        public pages — home, personas, pricing, blog, CMS
│   ├── (auth)/              login, register
│   ├── (app)/                chat, dashboard, rooms, crews, marketplace   (per-team, dynamic)
│   ├── admin/                admin panel                                  (gated twice: proxy + layout)
│   │                          incl. Teamwork — projects, bot teams, runs, rooms
│   └── api/
│       ├── chat/              streaming completion + billing
│       ├── rooms/[id]/stream/ SSE for group-chat/crew realtime (LISTEN/NOTIFY)
│       ├── webhooks/          payment providers
│       └── auth/              Auth.js handlers
├── db/
│   ├── schema.ts             64 tables — core schema + feature-module barrels at the tail
│   └── seed.ts                idempotent
├── lib/
│   ├── ai/registry.ts         DB-backed provider/model registry
│   ├── jobs/                  durable Postgres job queue (SKIP LOCKED) + in-process worker
│   ├── billing/credits.ts    the ONLY place a team wallet balance changes
│   ├── billing/entitlements.ts  subscriptions/passes/marketplace-install grants
│   ├── billing/gateways.ts   Stripe · PayPal · bank transfer
│   ├── modules/registry.ts   the plugin/module system's static manifest array
│   ├── marketplace/           vendor listing install + payout computation
│   ├── portability/          export/import bundle contracts + bundle builder
│   ├── permissions.ts         team-role permission checks
│   ├── persona/prompt.ts     system-prompt assembly
│   ├── persona/convert.ts    document → draft persona (admin-only bot converter)
│   ├── documents/extract.ts  .docx/.xlsx readers, zero dependencies
│   ├── site/nav.ts            visitor vs member navigation
│   └── admin/nav.ts           admin sidebar, as data
│   └── auth.ts                 Auth.js v5
├── modules/                  feature modules (group-chat, crews) — see docs/08-module-architecture.md
├── instrumentation.ts        starts the job worker (guarded against edge, dev, and build)
├── server/actions/            Server Actions, all zod-validated
└── components/
```

**`docs/00-overview.md`** is the index into 48 documents covering every piece, and each one is
written for the design decisions and trade-offs behind the code rather than a restatement of it —
including what was deliberately *not* built, and why.

What has been built on top of the original persona-catalogue-and-chat app, roughly in order:

| | |
|---|---|
| **Foundations** | teams/workspaces · three-level authorization · a plugin module system (27 manifests) · a DB-backed AI model registry · persona versioning with immutable published versions |
| **Money** | team wallets · subscriptions · time-boxed passes · usage events · an external-vendor marketplace with payouts |
| **Multi-bot** | group-chat rooms with `@mention` routing · bot-to-bot crews (pipeline / fan-out / delegating) · a durable job queue so runs survive the request · projects that group chats, rooms and crews |
| **Content** | a block builder driving the front page, CMS pages and blog posts · nested menus · a showcase · translations from a modular word bank |
| **Growth** | a site assistant that *is* a persona · lead-capture quick actions · an admin-only bot converter turning a document into a draft persona |
| **Craft** | a theme composer generating WCAG-checked ramps · an admin design system with real loading and empty states · audience-split public navigation |

Every capability has a manifest in `src/lib/modules/registry.ts` — that registry is the single
source of truth for what this platform can do, and `npm run modules:verify` checks the dependency
graph resolves.

### Adding an AI provider

One entry in `src/lib/ai/registry.ts`'s DB-backed catalog (`/admin/ai-models`), or a row insert.
Any OpenAI-compatible endpoint (OpenRouter, Groq, Together, LM Studio, vLLM, Ollama) needs no new
code at all — just a base URL.

### Adding a payment gateway

Implement `PaymentGateway` in `src/lib/billing/gateways.ts` and add it to the registry. Webhooks
route to `/api/webhooks/<id>` automatically.

### How billing works

`credit_wallets.balance` is a **cached** balance, one wallet per team (or per personal "team of
one"). `credit_transactions` is append-only and is the source of truth. Every write goes through
`src/lib/billing/credits.ts` inside a transaction that locks the wallet row, so concurrent requests
cannot double-spend. Recurring subscriptions and time-boxed access passes are tracked separately as
`entitlements`, checked before a wallet is ever charged.

Charging happens in the AI SDK's `onFinish` callback, from the token usage the provider actually
reported — never an estimate, and never for a reply that failed halfway.

Order fulfilment and webhook handling are idempotent — a replayed Stripe webhook grants credits, a
subscription renewal, or a marketplace entitlement exactly once.

### Adding a feature module

See `docs/08-module-architecture.md`. In short: `src/modules/<key>/` with a `manifest.ts`
(dependencies, permissions, nav, settings schema), its own `schema.ts` re-exported through
`src/db/schema.ts`'s tail, `actions.ts`, and an `index.ts` as the only file other code may import
from. Register it in `src/lib/modules/registry.ts`; `npm run modules:verify` checks the dependency
graph resolves before every build.

---

## Production notes

- **Streaming must not be buffered.** `next.config.ts` already sends `X-Accel-Buffering: no` on
  `/api/chat`. If you put nginx or a CDN in front, disable response buffering for that path and for
  `/api/rooms/*/stream` (group chat/crews realtime) too — otherwise replies arrive in one lump
  instead of token by token, and SSE updates never arrive at all.
- **Serverless execution limits.** `/api/chat` declares `maxDuration = 300`. On Vercel this needs a
  plan that allows it; on other hosts raise the gateway timeout to match.
- **Connection pool.** Set `DB_POOL_MAX` to match your database's limit divided by expected
  concurrent instances. The default (10) is fine for a single VPS and far too high for wide
  serverless fan-out.
- **The job worker runs inside the web process.** `src/instrumentation.ts` starts it, so scaling to
  more than one instance means more than one worker. That is safe by design — the claim query uses
  `FOR UPDATE SKIP LOCKED` and a stale-heartbeat reclaim — but throughput per instance is one job at
  a time. See `docs/46-job-queue.md`.
- `AUTH_SECRET` must be set in production or Auth.js refuses to start.
- Apply new migrations the same way as the initial install — hand-written `drizzle/000N_*.sql`
  files via `psql`, in order, never `db:push`/`db:migrate`.

See `DEPLOY.md` for a gated, actually-verified deployment runbook.
