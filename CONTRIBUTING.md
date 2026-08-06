# Working on Freelee locally

This is the guide for a coworker (or any local dev environment — including another Claude Code
session running on your own machine) setting this project up **outside** the production server,
working on it, and syncing back. If you're deploying to production instead, see `DEPLOY.md`.

---

## 1. Clone and install

```bash
git clone https://github.com/reception-ifairy/freelee-cv.git
cd freelee-cv
npm install
```

The repo is **public** but read-only to you unless you've been added as a collaborator (ask the
project owner to add your GitHub username under repo Settings → Collaborators) or you fork it and
open PRs from the fork. Either way, **never commit `.env.local` or any real API key/secret** —
`.gitignore` already excludes `.env`/`.env.local`, don't fight it.

## 2. Environment

```bash
cp .env.example .env.local
```

Fill in a `DATABASE_URL` pointing at your **own local** Postgres (or Docker) — never point a local
dev environment at the production database. AI features need at least one provider key
(`OPENAI_API_KEY` is simplest); without one, everything except chat/generation still works.
Generate `AUTH_SECRET` with `npx auth secret`.

## 3. Schema and seed data

**Do not run `npm run db:push` or `npm run db:migrate`** — both wrap `drizzle-kit`, which hangs
waiting for interactive input against this project's history of hand-edited schema changes (see
`app/docs/00-overview.md`'s "Migrations" section for why). Apply the real migration files instead:

```bash
for f in drizzle/000*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || { echo "FAILED on $f"; break; }
done

npm run db:seed              # platform team, admin/demo users, 8 demo personas, CMS
npm run db:seed-ai-models    # AI provider/model catalog
npm run modules:sync         # module registry mirror
```

This gives you a working local instance with seed data — `admin@freelee.cv` / `password`. That's
usually enough to develop against. If you want something closer to the real production catalog
(more personas, real content), see the export/import workflow below instead of asking for
production DB access.

```bash
npm run typecheck && npm run build && npm run dev   # http://localhost:3000
```

## 4. Getting realistic data without production DB access

The app has a built-in export/import system (`docs/15-data-portability.md`) — built for teams
exporting their own data, but it's exactly the right tool for moving a snapshot from the live
server into your local database too, without ever handing out the production `DATABASE_URL`.

**On the server** (someone with production access runs this — e.g. ask in the session where
Claude is working directly on the server):

```bash
npm run data:export -- --team=<team-id> --out=export.json
```

This writes one JSON file: personas + full version history, crews, room/crew-run conversations,
direct chats, and usage — everything a team owns. **Send `export.json` to the coworker through a
private channel — Slack DM, a shared drive, scp, whatever you'd use for any other file with real
content in it. Never commit it to the git repo or paste it anywhere public** — depending on the
team, it can contain real conversation content and real persona system prompts.

**Locally**, once you have the file:

```bash
npm run data:import -- --team=<your-local-team-id> --bundle=export.json          # dry run first (default)
npm run data:import -- --team=<your-local-team-id> --bundle=export.json --apply  # writes for real
```

Find `<your-local-team-id>` with `psql "$DATABASE_URL" -c "select id, name from teams;"` — the
seeded platform team from step 3 works fine as the import target. Import is idempotent — running
it again just skips everything already imported, so it's safe to re-run rather than track by hand
what you've already pulled in.

**Scope, honestly**: only `personas`, `personaVersions`, `crews`, and `crewMembers` are
re-importable — conversations/chats/messages/usage export for reference but aren't wired for
import (see `docs/15-data-portability.md` for why). If you need a specific team's full transcript
history for debugging something, that still needs someone with real DB access to pull it directly.

## 5. Working on translations

The site's language (Polish and German alongside English so far) is a small, dedicated system —
`docs/17-translations.md` has the full design. If you have admin access to a running instance
(local or the server), `/admin/translations` does everything below through a UI — add a language
by typing its name, the AI resolves the code and translates automatically; export/import buttons
are right there too. The CLI paths below are for working on it without a browser, or for scripting.

**A. Review/edit existing translations, no AI needed.** Pull the current database content, edit
the JSON by hand, send it back:

```bash
# on the server (or wherever has production DB access):
npm run i18n:export -- --out=translations.json
# → send translations.json through a private channel, same rule as step 4 above

# locally, after editing the file:
npm run i18n:import -- --file=translations.json          # dry run first
npm run i18n:import -- --file=translations.json --apply  # writes for real
```

The file is a flat JSON array of `{namespace, key, locale, value}` rows — readable and editable in
any text editor, no special tooling needed. It only ever contains non-English rows (English lives
as the literal fallback string at each `t(key, fallback)` call site in the source, never in the
database — see the schema comment on the `translations` table).

**B. Add a new translated string, or a new locale, from scratch.** If you've wired up a new
`t('some.key', 'English text')` call site (see `src/lib/i18n/translate.ts` and
`docs/17-translations.md` for the pattern), rebuild the word bank and (optionally) let AI draft the
translation:

```bash
npm run i18n:extract -- --namespace=frontend               # rescans the registered files, rewrites i18n/frontend.en.json
npm run i18n:translate -- --namespace=frontend --locale=pl # AI-drafts Polish for anything new, upserts into the DB
```

`i18n:translate` calls the platform's own configured OpenAI provider — it needs a working
`OPENAI_API_KEY` (or a DB-stored one, same as chat) and writes directly to your local database
(or the server's, if that's where you're running it). Always spot-check AI output before treating
it as final — it's a good first draft, not a substitute for a native speaker's review.

## 6. Sending work back

Code changes go through git, normally:

```bash
git checkout -b your-branch-name
# make changes
git add <files>          # review `git status` — never blanket `git add -A` without checking
git commit -m "..."
git push -u origin your-branch-name
```

Then open a PR against `main` on GitHub. `npm run typecheck` and `npm run build` should both pass
before you open it — there's no CI running these automatically yet, so it's on you.

If your local changes need a schema migration: hand-write it as
`drizzle/00NN_description.sql` (sequential, one more than the highest existing file — see
`app/docs/00-overview.md`), same as every migration already in the repo. Don't try to generate one
with `drizzle-kit generate` and expect it to match this project's conventions exactly — check it
against a couple of the existing files first.

## 7. What this workflow does *not* cover

- **No automated two-way data sync.** This is manual, one-shot snapshots in either direction, not
  a live replication setup. If the local and server datasets need to converge again later, export/
  import again.
- **No production writes from a coworker's machine.** Only someone with the real
  `DATABASE_URL`/server access applies migrations or runs scripts against production — everything
  in this doc assumes your own local database.
- **Secrets never travel through this system.** `.env.local`, API keys, and the production
  `DATABASE_URL` are never part of an export bundle or a git commit — if you ever see one in a
  diff, stop and flag it before pushing.
