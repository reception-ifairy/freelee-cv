import 'server-only';
import { registerHandler, startWorker } from './worker';
import { runCrewRunJob } from '@/modules/crews/job';
import { runLibrarySweepJob, SWEEP_KIND } from '@/lib/library/job';
import { RETENTION_KIND, runRetentionJob, scheduleRetention } from '@/lib/children/retention-job';

/**
 * Wires every job kind to its handler, then starts the loop.
 *
 * One place, imported once from `instrumentation.ts`. A handler registered
 * anywhere else would only exist in whichever request happened to import it,
 * which is exactly the kind of "works on my page" bug a queue must not have.
 */
export function startJobs() {
  registerHandler('crew.run', runCrewRunJob);
  registerHandler(SWEEP_KIND, runLibrarySweepJob);
  // Children's data retention (docs/54): once a day; a missed day is caught up at the next start.
  registerHandler(RETENTION_KIND, runRetentionJob);
  startWorker();
  void scheduleRetention().catch((error) => console.error('[retention] could not schedule', error instanceof Error ? error.message : error));
}
