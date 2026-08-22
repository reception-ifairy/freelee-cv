import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { JobRow } from '@/db/schema';
import { jobs } from '@/db/schema';
import { db } from '@/db';
import { enqueue, isCancelRequested } from '@/lib/jobs/queue';
import { ingestDocument } from './ingest';
import { pendingDocumentIds } from './scan';

/**
 * Processing the backlog, a slice at a time.
 *
 * The obvious design — one job per book — is wrong here for a structural
 * reason: this worker runs **exactly one job at a time** (src/lib/jobs/worker.ts
 * says so and means it), so five hundred queued books would hold the queue for
 * hours and every crew run behind them would simply wait.
 *
 * A sweeper claims work until a count or a clock says stop, then re-enqueues
 * itself. The queue drains between slices, so a crew run started halfway
 * through the backfill goes next rather than last; cancellation lands at a
 * slice boundary without needing to interrupt anything; and there is one code
 * path whether the work arrives as one book or a thousand.
 */

export const SWEEP_KIND = 'library.ingest_sweep';

/** Books per slice. Small enough that the queue is never held long, large enough to make progress. */
const SLICE_SIZE = 3;
/** …and a wall-clock cap, because one 900-page book is not three small ones. */
const SLICE_MS = 5 * 60 * 1000;

/**
 * Queue a sweep unless one is already waiting.
 *
 * `jobs` has no unique index on `kind`, so "only one sweep at a time" has to be
 * asserted rather than enforced. A duplicate would not corrupt anything — the
 * atomic claim in ingest.ts makes double-processing impossible — but it would
 * put two sweepers in a queue that runs one job at a time, which is just a
 * slower way to do the same work.
 */
export async function requestLibrarySweep(): Promise<void> {
  const existing = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.kind, SWEEP_KIND), inArray(jobs.status, ['queued', 'running'])))
    .limit(1);
  if (existing.length > 0) return;

  // maxAttempts 2, not the default 3: a book that fails twice is a data
  // problem, and a retry re-embeds the whole thing.
  await enqueue(SWEEP_KIND, {}, { maxAttempts: 2 });
}

export async function runLibrarySweepJob(job: JobRow): Promise<void> {
  const deadline = Date.now() + SLICE_MS;
  const shouldCancel = () => isCancelRequested(job.id);

  let processed = 0;
  while (processed < SLICE_SIZE && Date.now() < deadline) {
    if (await shouldCancel()) return;

    const [documentId] = await pendingDocumentIds(1);
    if (!documentId) return; // backlog empty — nothing to re-enqueue

    // A failing book must not fail the sweep: ingestDocument records its own
    // error on the document row, and the next slice moves on to the next book.
    const outcome = await ingestDocument(documentId, { shouldCancel });
    if (outcome.status === 'skipped' && outcome.reason.startsWith('Cancelled')) return;
    processed++;
  }

  if (await shouldCancel()) return;
  const more = await pendingDocumentIds(1);
  if (more.length > 0) await enqueue(SWEEP_KIND, {}, { maxAttempts: 2 });
}
