import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobs, type JobRow } from '@/db/schema';

/**
 * The queue itself: enqueue, claim, finish.
 *
 * Postgres is the broker. `SELECT … FOR UPDATE SKIP LOCKED` is the standard
 * primitive for exactly this problem and needs no Redis — concurrent claimers
 * step over each other's locked rows instead of blocking or handing the same
 * job to two workers. This app already uses Postgres for LISTEN/NOTIFY, so it
 * is not a new dependency either.
 *
 * Delivery is **at-least-once, not exactly-once**. A worker can die after
 * doing the work and before marking the job done, and the job will be retried.
 * Every handler must therefore be idempotent; `executeCrewRun`'s
 * `if (run.status !== 'queued') return run` guard is what makes `crew.run`
 * safe, and it is load-bearing rather than defensive clutter.
 */

/** How long a `running` job may go without a heartbeat before another worker may take it. */
export const STALE_AFTER_MS = 90_000;

export async function enqueue(
  kind: string,
  payload: Record<string, unknown>,
  options: { runAfter?: Date; maxAttempts?: number } = {},
): Promise<JobRow | null> {
  try {
    const [job] = await db
      .insert(jobs)
      .values({
        kind,
        payload,
        runAfter: options.runAfter ?? new Date(),
        maxAttempts: options.maxAttempts ?? 3,
      })
      .returning();
    return job;
  } catch {
    // A partial unique index keeps one live `crew.run` per run id, so a
    // double-submitted form is a no-op rather than the same crew running
    // twice. Swallowing it here is the point of having the index.
    return null;
  }
}

/**
 * Takes the next due job, or null.
 *
 * The whole claim is one statement so there is no window between choosing a row
 * and marking it taken. `FOR UPDATE SKIP LOCKED` is what makes that safe under
 * concurrency; `ORDER BY run_after` makes it fair.
 */
export async function claimNext(workerId: string): Promise<JobRow | null> {
  // Staleness is computed by Postgres, not by Node.
  //
  // Two reasons. A JS Date handed to `db.execute` as a bind parameter is
  // rejected by postgres.js outright ("The string argument must be of type
  // string... Received an instance of Date"), and more importantly the
  // database clock is the only one both the writer and the reclaimer agree
  // on — comparing a heartbeat written by Postgres against a cutoff computed
  // in Node makes clock skew a correctness bug.
  const staleInterval = sql.raw(`interval '${Math.round(STALE_AFTER_MS)} milliseconds'`);

  const rows = await db.execute<JobRow>(sql`
    UPDATE ${jobs}
       SET status = 'running',
           attempts = ${jobs.attempts} + 1,
           locked_at = now(),
           locked_by = ${workerId},
           heartbeat_at = now(),
           updated_at = now()
     WHERE id = (
       SELECT id FROM ${jobs}
        WHERE (status = 'queued' AND run_after <= now())
           -- Reclaim: a job whose worker died mid-run stopped heartbeating.
           -- Without this a pm2 restart would strand it as 'running' forever.
           OR (status = 'running' AND heartbeat_at < now() - ${staleInterval})
        ORDER BY run_after
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
    RETURNING *;
  `);

  const [row] = rows as unknown as JobRow[];
  return row ?? null;
}

/** Keeps a long-running job from looking dead to the reclaim query. */
export async function heartbeat(jobId: string): Promise<void> {
  await db.update(jobs).set({ heartbeatAt: new Date() }).where(eq(jobs.id, jobId));
}

/** Whether someone asked for this job to stop. Read between steps, never mid-call. */
export async function isCancelRequested(jobId: string): Promise<boolean> {
  const [row] = await db.select({ c: jobs.cancelRequested }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return row?.c === true;
}

export async function requestCancel(jobId: string): Promise<void> {
  await db.update(jobs).set({ cancelRequested: true, updatedAt: new Date() }).where(eq(jobs.id, jobId));
}

export async function finish(jobId: string, status: 'done' | 'failed' | 'cancelled', error?: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status, lastError: error ?? null, lockedBy: null, lockedAt: null, updatedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/**
 * A failed attempt: retried with backoff until `maxAttempts`, then left failed.
 *
 * Backoff is exponential from one minute. The failures this queue will actually
 * see are provider timeouts and rate limits, and retrying those immediately
 * just burns the remaining attempts against the same wall.
 */
export async function retryOrFail(job: JobRow, error: string): Promise<void> {
  if (job.attempts >= job.maxAttempts) {
    await finish(job.id, 'failed', error);
    return;
  }

  const delayMs = Math.min(60_000 * 2 ** (job.attempts - 1), 15 * 60_000);
  await db
    .update(jobs)
    .set({
      status: 'queued',
      runAfter: new Date(Date.now() + delayMs),
      lockedBy: null,
      lockedAt: null,
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}

/** The live job for a crew run, if there is one — powers the cancel button. */
export async function jobForCrewRun(crewRunId: string): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.kind, 'crew.run'), sql`${jobs.payload}->>'crewRunId' = ${crewRunId}`))
    .orderBy(sql`${jobs.createdAt} desc`)
    .limit(1);
  return row ?? null;
}
