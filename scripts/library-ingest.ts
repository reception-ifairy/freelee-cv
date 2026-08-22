/**
 * The Knowledgebase backfill — scanning the folder and processing books from
 * the command line.
 *
 *   npx tsx --conditions=react-server scripts/library-ingest.ts --scan
 *   npx tsx --conditions=react-server scripts/library-ingest.ts --all [--concurrency=4]
 *   npx tsx --conditions=react-server scripts/library-ingest.ts --id=<documentId>
 *
 * `--conditions=react-server` is what makes this work: the library modules
 * import `server-only`, which throws outside a Next server context, and that
 * flag resolves the package to its no-op build. Every other script in this
 * project sidesteps the problem by building its own Drizzle client instead —
 * which is fine for a script that only reads tables, and wrong here, because a
 * second copy of a pipeline this long is how a CLI quietly stops matching what
 * production actually does. One implementation, two entry points.
 *
 * Why a CLI at all, when there is a queue: the worker runs exactly one job at
 * a time, so the first few hundred books would hold it for hours. This runs
 * beside the queue rather than through it, and cannot collide with it — both
 * take the same atomic claim in src/lib/library/ingest.ts, so whoever gets the
 * row processes it and the other moves on.
 */
// `.env.local` explicitly, not just dotenv's default `.env`: that is the file
// Next itself loads here, and there is no `.env` on this box at all — so the
// bare `dotenv/config` other scripts use would leave DATABASE_URL unset.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  // Imported *inside* main, not at the top. ESM evaluates every static import
  // before any top-level statement in this file, so a static import of
  // anything touching `@/db` would run before dotenv had loaded and die on a
  // DATABASE_URL that is in fact right there in .env.local.
  const { scanLibrary, pendingDocumentIds } = await import('../src/lib/library/scan');
  const { ingestDocument } = await import('../src/lib/library/ingest');

  if (has('scan') || (!has('all') && !arg('id'))) {
    const summary = await scanLibrary();
    console.log(
      `Scanned: ${summary.added} new, ${summary.changed} changed, ${summary.unchanged} unchanged, ` +
      `${summary.missing} missing.`,
    );
    if (summary.collections.length > 0) console.log(`Collections: ${summary.collections.join(', ')}`);
    if (!has('all')) {
      const waiting = await pendingDocumentIds(1000);
      console.log(`${waiting.length} document(s) waiting. Run with --all to process them.`);
      return;
    }
  }

  const single = arg('id');
  if (single) {
    console.log(await ingestDocument(single));
    return;
  }

  const concurrency = Number(arg('concurrency') ?? 4);
  const queue = await pendingDocumentIds(100_000);
  console.log(`Processing ${queue.length} document(s), ${concurrency} at a time.\n`);

  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      const started = Date.now();
      const outcome = await ingestDocument(id);
      done++;
      const detail =
        outcome.status === 'ready'
          ? `${outcome.passages} passages, ${outcome.tokens} tokens`
          : 'reason' in outcome ? outcome.reason : 'detail' in outcome ? outcome.detail : outcome.error;
      console.log(`[${done}/${done + queue.length}] ${outcome.status.padEnd(9)} ${Math.round((Date.now() - started) / 1000)}s  ${detail}`);
    }
  });
  await Promise.all(workers);
}

main().then(
  () => process.exit(0),
  (error) => { console.error(error); process.exit(1); },
);
