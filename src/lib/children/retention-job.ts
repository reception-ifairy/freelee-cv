import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { jobs, type JobRow } from '@/db/schema';
import { enqueue } from '@/lib/jobs/queue';
import { runRetentionSweep } from './retention';

export const RETENTION_KIND = 'children.retention';
const DAY_MS = 86_400_000;

/** Makes sure one daily sweep is waiting (called when the worker starts). */
export async function scheduleRetention(runAfter = new Date()): Promise<void> {
  const waiting = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.kind, RETENTION_KIND), inArray(jobs.status, ['queued', 'running']))).limit(1);
  if (waiting.length === 0) await enqueue(RETENTION_KIND, {}, { runAfter, maxAttempts: 2 });
}

export async function runRetentionJob(_job: JobRow): Promise<void> {
  const result = await runRetentionSweep();
  console.log(`[retention] lessons deleted ${result.lessonsDeleted}, notices ${result.noticesSent}, profiles deleted ${result.profilesDeleted}`);
  // The next one tomorrow; this job is still `running`, so enqueue directly instead of through scheduleRetention.
  await enqueue(RETENTION_KIND, {}, { runAfter: new Date(Date.now() + DAY_MS), maxAttempts: 2 });
}
