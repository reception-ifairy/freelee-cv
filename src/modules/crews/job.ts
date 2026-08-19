import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { crewRuns, type JobRow } from '@/db/schema';
import { executeCrewRun } from './runner';
import { isCancelRequested } from '@/lib/jobs/queue';

/**
 * The `crew.run` job handler.
 *
 * Thin on purpose: the job owns *scheduling and lifecycle*, `executeCrewRun`
 * keeps owning *what a crew does*, and `runPersonaTurn` — the single execution
 * primitive both crews and rooms share — is not touched at all. That split is
 * why crews was small enough to build in the first place and it should survive
 * this change.
 */
export async function runCrewRunJob(job: JobRow): Promise<void> {
  const crewRunId = String(job.payload.crewRunId ?? '');
  if (!crewRunId) throw new Error('crew.run job has no crewRunId');

  await executeCrewRun(crewRunId, {
    // Read between steps by the runner. It cannot interrupt a model call
    // already in flight, so a cancel lands after the current persona finishes
    // speaking — the UI says that rather than implying an instant stop.
    shouldCancel: () => isCancelRequested(job.id),
  });

  // Jobs are at-least-once: a worker can die after the run finished and before
  // the job was marked done, and the retry would find the run already terminal.
  // `executeCrewRun`'s own `status !== 'queued'` guard makes that a no-op.
  const [run] = await db.select({ status: crewRuns.status }).from(crewRuns).where(eq(crewRuns.id, crewRunId)).limit(1);
  if (run && run.status === 'running') {
    throw new Error('Crew run ended without reaching a terminal status');
  }
}
