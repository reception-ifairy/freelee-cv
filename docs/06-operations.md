# Operations

## Standard deploy checklist

```bash
cd /var/www/freelee.cv/app
npm run typecheck                 # tsc --noEmit — catches type drift before it ships
npm run build                     # next build
pm2 restart aigency-freelee
pm2 logs aigency-freelee --lines 50 --nostream   # confirm clean start, no runtime errors
curl -s -o /dev/null -w "%{http_code}\n" https://freelee.cv/    # expect 200
```

If a schema change is included, **apply the migration before the deploy that reads the new
columns**, or immediately after if the code was already built — a mismatch here is a guaranteed
`column "..." does not exist` 500 on every query touching that table (happened once during the UK
taxonomy work; fixed within a minute by applying the pending migration). See `01-database.md` for the
hand-written-SQL migration process forced by the TTY constraint.

## Splitting risky changes into multiple deploys

For anything touching more than one concern (e.g. schema + new admin UI + data backfill), prefer
shipping in the order: schema/migration → code that reads it → data backfill last, so the admin UI is
already live to verify the backfill's result immediately. This was the pattern for both the AI model
tier system and the UK taxonomy work.

## Data migrations / backfills

Not numbered `drizzle/*.sql` files — one-off scripts, written to the session scratchpad, following a
consistent shape:
1. Snapshot the affected table(s) to a file before touching anything (`\copy ... TO '...csv'` or
   `pg_dump --table=... --data-only`).
2. Wrap the actual work in `BEGIN` / `COMMIT`, idempotent where possible (`UPDATE ... WHERE`,
   `INSERT ... ON CONFLICT DO UPDATE`).
3. A `DO $$ ... RAISE EXCEPTION ... END $$;` verification block **before** `COMMIT`, asserting the
   expected row counts/values — the transaction aborts automatically if the assertion fails.

For backfills sourced from an external SQL dump with a different schema shape (uuid PKs, extra
columns), the lowest-risk approach is **not** hand-transcribing rows: create temp staging tables that
mirror the source dump's exact column list, replay its own `INSERT` statements verbatim (only the
target table name retargeted) so Postgres parses the literals/jsonb itself, then `INSERT ... SELECT`
/`UPDATE ... FROM` into the live tables joining on a natural key (name, code). This is how the 103
sectors and 20 categories' market data were backfilled without a single hand-typed data row.

## Domain hygiene

`scripts/archive-legacy-domain-deployments.sh` (project root) — archives (never deletes) stale
subdomain deployments: stops the one Freelee-specific redundant pm2 process (`dev-freelee-cv`), moves
directories to `/var/backups/freelee-legacy-archive/<timestamp>/`, disables the corresponding nginx
vhosts, validates with `nginx -t` before reloading. Deliberately leaves the `darkaik-online` pm2
process untouched even though `demo.freelee.cv`'s vhost was misrouted to it — that process serves
other, unrelated live domains. Already run once (2026-08-03); safe to re-run (idempotent, checks
before acting) if new stale deployments accumulate.

## Verifying a live change end-to-end without a browser

- **Compiled system prompt**: `npx tsx` a small script that imports `buildSystemPrompt` directly with
  a fake persona object and inspects the output string — faster and more precise than a live chat
  round-trip, and doesn't need admin credentials. Delete the scratch script after.
- **What model actually answered**: query `messages.model`/`messages.aiProvider` for the relevant
  chat (see `02-ai-models.md`) rather than guessing from the reply text.
- **CSS actually shipped**: `grep` the compiled chunk in `.next/static/chunks/*.css` for the literal
  class/property name — catches the "written in source but silently dropped by the build" class of
  bug (see the `@layer` note in `03-admin-panel.md`).
