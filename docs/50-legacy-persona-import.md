# Legacy persona import

`personattest.json` is not JSON. It is a UTF-8 MySQL dump containing six
concatenated `INSERT INTO prompts` statements, 126 tuples and 49 columns. The
global importer migrates it without ever executing that SQL.

The migration has one non-negotiable property: **the production catalog is not
cleared while AI work is still in progress**. Conversion produces a private,
resumable checkpoint first. A later, short transaction removes the audited test
dataset and inserts the complete replacement together; failure rolls both back.

## Source profile

The parser in `src/lib/persona/legacy-source.ts` implements only the MySQL
literal grammar this export uses: quoted strings, MySQL backslash escapes,
numbers and `NULL`. Every INSERT must contain the exact known 49-column list.
Unknown statements or malformed tuples fail closed.

| Check | Required result |
|---|---:|
| INSERT blocks | 6 |
| Source rows | 126 |
| Target characters | 122 |
| Active (`status=1`) | 87 |
| Hidden (`status=0`) | 35 |
| Duplicate groups | 4 |

Three duplicate pairs are identical apart from their source id. The fourth is
the same E-commerce character with a different legacy Google voice locale.
Freelee has no per-persona Google voice field, so both rows have the same target
projection and are one character. Any duplicate slug whose target content
differs causes an error rather than an arbitrary winner.

## Conversion and taxonomy

`--prepare` makes one `google/gemini-flash-latest` call per character. It
extends the existing `convertedPersonaSchema` with `categorySlug`, `sectorSlug`,
`taxonomyConfidence` and `taxonomyReason`; this avoids paying for a second
classification call. The model sees the closed 20-category/103-sector catalog.
Both slugs are checked against live Postgres and the sector must belong to the
chosen category.

The source name and slug remain authoritative. AI normalises the marketplace
description, welcome, system prompt, four suggestions, knowledge domains,
personality and cognitive blueprint. Runtime uses OpenAI's `balanced` tier,
matching the interactive converter. Sampling parameters and the twelve
supported capability flags are mapped deterministically from the old row.

Every imported persona receives one category and sector. Category colour,
audience tags and mandatory risk-compatible guardrails come from the live
taxonomy. Published versions are immutable `1.0.0` with version pinning on.
The old status controls `is_active`; hidden rows are imported but do not appear
in the public directory.

## Operator runbook

Run from `/var/www/freelee.cv/app`. The npm command loads `.env.local` and the
React server condition required by modules marked `server-only`.

```bash
# Parser/source contract only; no DB or AI writes
npm run personas:verify-import

# 122 resumable model calls; production DB remains unchanged
npm run personas:import-legacy -- --prepare

# If interrupted, completed source keys are not called again
npm run personas:import-legacy -- --prepare --resume

# Full read-only validation of source, checkpoint, taxonomy and cleanup baseline
npm run personas:import-legacy -- --dry-run
```

The private default checkpoint is
`/var/backups/freelee-persona-import/personattest.checkpoint.json`; its adjacent
report lists duplicates, category totals and classifications below 0.65
confidence. Both files and their directory are mode `0600`/`0700` and must
never be committed or put below the web root.

Immediately before applying, stop the web process so no chat or worker can
write between the backup and transaction, then make and inspect a full backup:

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="/var/backups/freelee-persona-import/$stamp"
install -d -m 700 "$backup_dir"
pg_dump "$DATABASE_URL" --format=custom --file="$backup_dir/aigency_freelee.dump"
chmod 600 "$backup_dir/aigency_freelee.dump"
pg_restore --list "$backup_dir/aigency_freelee.dump" >/dev/null
sha256sum /var/www/freelee.cv/personattest.json >"$backup_dir/source.sha256"
cp /var/backups/freelee-persona-import/personattest.checkpoint.json "$backup_dir/"
cp /var/backups/freelee-persona-import/personattest.checkpoint.report.json "$backup_dir/"
chmod 600 "$backup_dir"/*

npm run personas:import-legacy -- --apply --purge-existing
```

`--apply` refuses to run if the audited test baseline has drifted. Its single
transaction removes the three test personas, direct chats/messages, workbench
and crew data, jobs, the `test` project, usage facts and platform spend rows;
it preserves accounts, teams, bonuses, taxonomy, CMS, settings and model
registry. Wallet and deprecated user credit caches are recomputed from the
remaining bonus history. Serial sequences are deliberately not reset.

Restart and verify after commit:

```bash
pm2 start /var/www/freelee.cv/ecosystem.config.cjs --only aigency-freelee
pm2 logs aigency-freelee --lines 100 --nostream
curl -fsS https://freelee.cv/ >/dev/null
curl -fsS https://freelee.cv/personas >/dev/null
```

## Failure and recovery

- Preparation failure leaves the last valid checkpoint on disk; use
  `--prepare --resume`.
- Invalid model JSON or taxonomy is retried three times, then stops preparation.
- An incomplete checkpoint can never reach apply.
- Cleanup or insert assertion failure rolls the whole transaction back, leaving
  the previous test dataset intact.
- After a committed failure outside the transaction, restore the custom dump
  with the normal PostgreSQL restore procedure while the app remains stopped.

No schema migration is involved. The CLI, parser and docs are safe to publish;
the source prompts, generated checkpoint and backup are operational data and
remain private.
