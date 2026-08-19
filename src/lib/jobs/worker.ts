import 'server-only';
import { randomUUID } from 'node:crypto';
import { claimNext, finish, heartbeat, retryOrFail } from './queue';
import type { JobRow } from '@/db/schema';

/**
 * The in-process job worker.
 *
 * It runs inside the one Next.js process rather than a second pm2 app. That is
 * the same judgement already written into `crews/runner.ts` — no worker infra
 * exists here, and standing a new process up needs to be earned. One process
 * means **one job at a time**, which is a real limit and an honest one: crew
 * runs are minutes-long and rare, not a stream.
 *
 * If a second app instance is ever added, this design still holds. `FOR UPDATE
 * SKIP LOCKED` means two workers never take the same job, and the heartbeat
 * reclaim means neither strands work when it dies.
 */

export type JobHandler = (job: JobRow) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

const POLL_MS = 2_000;
const HEARTBEAT_MS = 15_000;

/**
 * Module-level, deliberately.
 *
 * `next dev` invokes the instrumentation hook more than once, and without this
 * every reload would start another polling loop against the same table. In
 * production it guards a double `register()` just as cheaply.
 */
let started = false;

export function startWorker() {
  if (started) return;
  started = true;

  const workerId = `${process.pid}-${randomUUID().slice(0, 8)}`;
  console.log(`[jobs] worker ${workerId} started`);

  const tick = async () => {
    let job: JobRow | null = null;
    try {
      job = await claimNext(workerId);
    } catch (error) {
      // The database being briefly unreachable must not kill the loop —
      // otherwise one blip means no jobs run until the next deploy.
      console.error('[jobs] claim failed', error);
    }

    if (!job) {
      setTimeout(tick, POLL_MS);
      return;
    }

    const handler = handlers.get(job.kind);
    // Keep the row alive while the handler works, so the reclaim query does not
    // decide a legitimately slow job is a dead one.
    const beat = setInterval(() => void heartbeat(job!.id).catch(() => {}), HEARTBEAT_MS);

    try {
      if (!handler) throw new Error(`No handler registered for job kind "${job.kind}"`);
      await handler(job);
      await finish(job.id, 'done');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[jobs] ${job.kind} ${job.id} failed:`, message);
      await retryOrFail(job, message).catch(() => {});
    } finally {
      clearInterval(beat);
      // Straight back round rather than waiting a poll interval: a queue with
      // work in it should drain, not tick.
      setTimeout(tick, 0);
    }
  };

  setTimeout(tick, POLL_MS);
}
