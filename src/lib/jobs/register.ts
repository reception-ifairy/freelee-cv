import 'server-only';
import { registerHandler, startWorker } from './worker';
import { runCrewRunJob } from '@/modules/crews/job';

/**
 * Wires every job kind to its handler, then starts the loop.
 *
 * One place, imported once from `instrumentation.ts`. A handler registered
 * anywhere else would only exist in whichever request happened to import it,
 * which is exactly the kind of "works on my page" bug a queue must not have.
 */
export function startJobs() {
  registerHandler('crew.run', runCrewRunJob);
  startWorker();
}
