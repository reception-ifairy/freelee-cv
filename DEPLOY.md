# Freelee — install & deploy runbook

**Give this file to Claude Code.** It is written as an executable set of
instructions: run the phases in order, verify at each gate, stop and report if
a gate fails.

This runbook was verified end-to-end against a real, empty Postgres database
on 2026-08-06 (Part C of the "Reset checkpoint" work) — every step below was
actually run, not just described. One real gap was found and fixed doing
that: `drizzle/0009_persona_versions.sql` was missing six `personas` columns
(`audience_type`, `blueprint`, `interaction_style`, `approach_to_unknown`,
`prompt_technique`, `thinking_mode`) that had been added to production by
hand, predating the migration trail. If a future fresh install ever fails on
a "type does not exist" or "column does not exist" error, the same thing has
happened again — diff `information_schema.columns` for the affected table
against a reference database and patch the migration, the way that one was
fixed.

---

## Agent instructions

You are deploying a Next.js 16 application with a much larger surface than a
typical starter: multi-tenant teams, a plugin-style module system, an
AI-model registry, versioned personas, team wallets, group chat, bot crews,
data export/import, and an external-vendor marketplace — nine feature phases
built on top of the original persona-catalog-and-chat app. Work through the
phases below in order. Each ends with a **Gate** — a command whose output
must be correct before you continue. Do not skip a gate, and do not make a
gate pass by disabling the check.

Four rules specific to this app:

1. **Never print or commit secrets.** If you must confirm a value, confirm
   that it is set, not what it is.
2. **Streaming must not be buffered.** Several defaults (nginx
   `proxy_buffering`, CDN buffering) silently break the chat feature by
   holding the whole response until it completes. Phase 5 covers it — test
   it, do not assume.
3. **`drizzle-kit generate`/`push`/`migrate` require an interactive TTY and
   hang in a non-interactive shell.** This is why the schema step below
   applies hand-written SQL files directly via `psql`, not those commands.
   Do not "fix" a hang by adding `-y` flags or piping input at it — use the
   real migration files.
4. **Migrations are a flat, hand-maintained sequence** (`drizzle/0000` through
   `drizzle/0014` today), applied via `psql`, in numeric order, every time —
   there is no partial-apply tracking to trust. `drizzle/meta/_journal.json`
   is known to be out of sync with reality and is not authoritative.

---

## Phase 0 — Environment

```bash
node -v     # need 20.9 or newer
npm -v
psql --version   # optional, but useful
```

You need a PostgreSQL 15+ database. Any of these work: local Postgres, Neon,
Supabase, Railway, RDS.

**Gate 0:** Node ≥ 20.9 and a `DATABASE_URL` you can connect to.

```bash
psql "$DATABASE_URL" -c 'select version();'
```

---

## Phase 1 — Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` — see the file for the full list (AI provider keys,
Stripe/PayPal, credit defaults). At minimum:

```dotenv
DATABASE_URL="postgresql://user:pass@host:5432/freelee"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate the auth secret (never invent one by hand):

```bash
npx auth secret
```

**Gate 1:**

```bash
test -d node_modules && grep -q '^AUTH_SECRET=' .env.local && echo "GATE 1 OK"
```

---

## Phase 2 — Schema and seed

**Do not run `npm run db:push` or `npm run db:migrate` against this
project.** Both wrap `drizzle-kit`, which hangs waiting for interactive
conflict resolution in this codebase's history of hand-edited schema
changes. Apply the real migration files instead, in order:

```bash
for f in drizzle/000*.sql; do
  echo "=== $f ==="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || { echo "FAILED on $f"; break; }
done
```

Then seed base data — three separate scripts, in this order (the third and
fourth are easy to forget; a fresh install that stops after `db:seed` is
missing the AI model catalog and the module registry mirror):

```bash
npm run db:seed                          # platform team, admin/demo users, 8 demo personas, CMS, plans/packs
npm run db:seed-ai-models                # ai_providers/ai_models catalog
npm run modules:sync                     # modules/module_team registry mirror from src/lib/modules/registry.ts
```

**Gate 2:** 54 tables, the seed landed, and the module graph resolves.

```bash
psql "$DATABASE_URL" -c "select count(*) from information_schema.tables where table_schema='public';"
psql "$DATABASE_URL" -c "select email from users order by email;"
psql "$DATABASE_URL" -c "select count(*) as personas from personas;"
npm run modules:verify
```

Expect 54 tables, `admin@freelee.cv`/`demo@freelee.cv`, 8 personas, and
`modules:verify` reporting every module's dependencies resolve.

**Also verify the wallet ledger reconciles** — this is the invariant the
whole billing system rests on (team-scoped wallets since the Phase 5 billing
overhaul, not the older per-user `users.credits`/`credit_ledger` shape):

```bash
psql "$DATABASE_URL" -c "
  select t.name, w.balance, coalesce(sum(tx.amount),0) as ledger,
         w.balance = coalesce(sum(tx.amount),0) as reconciles
  from credit_wallets w
  join teams t on t.id = w.owner_id and w.owner_type = 'team'
  left join credit_transactions tx on tx.wallet_id = w.id
  group by w.id, t.name, w.balance order by t.name;"
```

Every row must show `reconciles = t`. If it does not, stop: something wrote
a balance outside `src/lib/billing/credits.ts`.

---

## Phase 3 — Build

```bash
npm run typecheck
npm run build
```

**Gate 3:** both exit 0. The build prints a route table — `/`, `/personas`,
`/pricing`, `/blog`, and `/marketplace` should be listed, and everything
under `/admin`, `/dashboard`, `/chat`, `/rooms`, and `/crews` must be marked
`ƒ (Dynamic)` — per-user/per-team pages must never be prerendered.

---

## Phase 4 — Smoke test locally

```bash
npm run start
```

Check in this order:

1. `http://localhost:3000` — landing page.
2. `/personas` — gallery (8 seeded personas), search and category filter work.
3. Sign in as `admin@freelee.cv` / `password` → `/admin` loads.
4. `/admin/settings?group=ai` → confirm an AI provider key is set (or paste
   one) → save.
5. `/personas/<slug>` → **Start a conversation** → send a message.
6. `/dashboard/team` → confirm the seeded team loads, modules list renders.
7. `/rooms`, `/crews`, `/marketplace` → each should load (empty state is
   fine) once their module is enabled for the team at `/dashboard/team`.

**Gate 4:** step 5 streams the reply **token by token**, not as one block at
the end. Then confirm billing was recorded against the team wallet:

```bash
psql "$DATABASE_URL" -c "
  select description, amount, balance_after from credit_transactions
  order by created_at desc limit 3;"
```

Expect a negative `amount` described as a chat/model charge.

**Change both seeded passwords now** if this host is reachable from the
internet.

---

## Phase 5 — Deploy

### Option A — Vercel (least work)

```bash
npx vercel link
npx vercel env add DATABASE_URL production
npx vercel env add AUTH_SECRET production
npx vercel env add NEXT_PUBLIC_APP_URL production
npx vercel env add OPENAI_API_KEY production
npx vercel --prod
```

Two settings that matter:

- `/api/chat` declares `maxDuration = 300`. Confirm your plan allows it, or
  the function is killed mid-generation.
- Set `DB_POOL_MAX=1` on Vercel. Each concurrent function gets its own pool;
  an unbounded default exhausts a small Postgres instance quickly. Use a
  pooled connection string (Neon/Supabase pooler) if available.

### Option B — VPS with nginx + pm2 (how the reference deployment runs)

```bash
npm ci && npm run build
pm2 start ecosystem.config.cjs   # or: npm run start, behind any process manager
```

`/etc/nginx/sites-available/freelee`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # --- Chat and SSE streams must NOT be buffered ---
    location ~ ^/(api/chat|api/rooms/.*/stream) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        proxy_buffering off;
        proxy_cache off;
        gzip off;
        proxy_read_timeout 300s;
        add_header X-Accel-Buffering no;
    }

    client_max_body_size 12M;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

### Option C — Docker

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
```

The build reads the database (marketing pages and the sitemap), so
`DATABASE_URL` must be reachable at build time — or those pages fall back to
their static defaults. Schema/seed (Phase 2) still has to run against the
target database separately; it is not part of this image.

---

## Phase 6 — Production configuration

```dotenv
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=...
DB_POOL_MAX=10          # 1–3 on serverless
AUTH_SECRET=...
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Payment webhooks

| Provider | URL | Events |
|---|---|---|
| Stripe | `https://your-domain.com/api/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` |
| PayPal | `https://your-domain.com/api/webhooks/paypal` | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` |

Both verify the signature and reject unsigned payloads. Send a test event
from each dashboard and confirm the order moves to `paid` and credits land
in the team wallet **once** (webhook delivery is at-least-once — idempotency
is enforced via `credit_transactions.idempotency_key`, see
`docs/12-billing-overhaul.md`).

---

## Phase 7 — Final gate

```bash
for p in / /personas /pricing /blog /marketplace /sitemap.xml /robots.txt; do
  printf "%-14s " "$p"
  curl -sS -o /dev/null -w "%{http_code}\n" "https://your-domain.com$p"
done
for p in /admin /dashboard/team /rooms /crews; do
  printf "%-14s " "$p"
  curl -sS -o /dev/null -w "%{http_code}\n" "https://your-domain.com$p"
done
```

The first group must all be `200`. The second group must all be
`307`/`302` (redirect to login) for an anonymous request. **If any of them
return `200` to an anonymous request, stop and fix the auth gate
(`src/lib/auth.config.ts`'s `authorized()` callback) before doing anything
else** — this has happened twice during this app's development (`/rooms`,
`/crews` were each missed from the middleware path list when first added).

**Streaming check — the one people skip.** In the browser: DevTools →
Network → send a chat message → select the `chat` request. The response
body must grow incrementally. If `Content-Length` is set or the body
arrives all at once, buffering is still on. Cloudflare buffers by default:
add a Configuration Rule disabling it for `/api/chat` and any
`/api/rooms/*/stream` path.

**Before announcing the site:**

- [ ] Changed the password on `admin@freelee.cv`, or deleted it and created
      your own
- [ ] Deleted or suspended `demo@freelee.cv`
- [ ] HTTPS enforced, certificate valid
- [ ] A test payment completed end to end and credits landed exactly once
- [ ] Database backups scheduled
- [ ] Reviewed `/privacy` and `/terms` — they are placeholder templates and
      are **not** legal advice; have a lawyer check them before taking real
      payments
- [ ] If enabling the marketplace module: read `docs/16-marketplace.md` —
      real Stripe Connect payouts are **not** implemented; `payouts` rows
      are previews only

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A migration fails with "type ... does not exist" or "column ... does not exist" | A schema change was made by hand against some earlier database and never captured in a migration file (has happened once — see the note at the top of this file) | Diff `information_schema.columns`/`information_schema.types` for the affected table between a working database and the fresh one; patch the migration file that should have included it |
| Reply appears all at once | Response buffering | `proxy_buffering off`; disable CDN buffering for `/api/chat` and `/api/rooms/*/stream` |
| Reply truncated mid-sentence | Function/gateway timeout | Raise it past `maxDuration` (300s) |
| "No AI provider is configured yet" | No API key | Set `OPENAI_API_KEY`, or Admin → Settings → AI |
| `too many connections` | Pool too large for the instance | Lower `DB_POOL_MAX`, use a pooled connection string |
| Credits not granted after payment | Webhook not arriving or signature wrong | Check the provider's webhook log; the endpoint returns 400 on a bad signature |
| `/admin`, `/rooms`, `/crews`, `/marketplace`, or `/dashboard/*` render for anonymous users | A new top-level route wasn't added to `src/lib/auth.config.ts`'s `authorized()` path list | Add the prefix alongside the existing ones; every new gated top-level route needs this explicitly |
| Balance disagrees with the wallet | Something wrote `credit_wallets.balance` directly | Everything must go through `src/lib/billing/credits.ts` |
| `drizzle-kit push`/`migrate` hangs | It always does, in this environment | Don't use it — apply `drizzle/000N_*.sql` via `psql` (Phase 2) |

## Useful commands

```bash
npm run typecheck          # tsc --noEmit
npm run build               # next build
npm run db:generate         # drizzle-kit generate — inspect the diff, do NOT apply it with push/migrate
npm run db:seed              # idempotent — safe to re-run
npm run modules:sync        # sync src/lib/modules/registry.ts into the modules table
npm run modules:verify      # confirm every module's requires.modules resolves
npm run db:seed-ai-models   # (re-)seed the AI provider/model catalog
npm run data:export -- --team=<id> --out=file.json   # data export (docs/15-data-portability.md)
npm run data:import -- --team=<id> --bundle=file.json [--apply]   # data import, dry-run by default
```

See `docs/00-overview.md` for the full architecture reference, and
`docs/01-database.md` through `docs/16-marketplace.md` for every feature
phase built on top of the original app, in order.
