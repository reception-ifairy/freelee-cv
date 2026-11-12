import 'server-only';
import { and, isNotNull, isNull, lt, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, childProfiles, users } from '@/db/schema';
import { sendEmail } from '@/lib/email/send';
import { getSettingString } from '@/lib/settings';

/**
 * Retention for children's data (docs/54), run daily by the job queue:
 *
 * - **Lessons** are deleted 90 days after their last message.
 * - **Profiles** unused for 11 months: the parent gets an email; after 12
 *   months (and at least 25 days after that email) the profile is deleted —
 *   and with it its key, plan and lessons (crypto-shredding).
 *
 * Counts only in the result and the log, never anything about a child.
 */
export const LESSON_DAYS = 90;
const NOTICE_MONTHS = 11;
const DELETE_MONTHS = 12;
const NOTICE_GRACE_DAYS = 25;

const monthsAgo = (n: number, now: Date) => new Date(now.getTime() - n * 30.44 * 86_400_000);
const daysAgo = (n: number, now: Date) => new Date(now.getTime() - n * 86_400_000);

export type RetentionResult = { lessonsDeleted: number; noticesSent: number; profilesDeleted: number; dryRun: boolean };

export async function runRetentionSweep(options: { dryRun?: boolean; now?: Date } = {}): Promise<RetentionResult> {
  const now = options.now ?? new Date();
  const dryRun = Boolean(options.dryRun);

  const oldLessons = and(isNotNull(chats.childProfileId), lt(chats.lastMessageAt, daysAgo(LESSON_DAYS, now)));
  const lessons = await db.select({ id: chats.id }).from(chats).where(oldLessons);
  if (!dryRun && lessons.length) await db.delete(chats).where(oldLessons);

  const toNotify = await db
    .select({ id: childProfiles.id, email: users.email, name: users.name })
    .from(childProfiles)
    .innerJoin(users, eq(users.id, childProfiles.parentUserId))
    .where(and(lt(childProfiles.lastActiveAt, monthsAgo(NOTICE_MONTHS, now)), isNull(childProfiles.retentionNoticeAt)));
  if (!dryRun) {
    const siteName = await getSettingString('site_name', 'Freelee');
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    for (const p of toNotify) {
      await sendEmail({
        to: p.email,
        subject: `A child profile on ${siteName} will be deleted next month`,
        text:
          `Hello${p.name ? ` ${p.name}` : ''},\n\nOne of the child profiles on your ${siteName} account has not been used for 11 months. ` +
          `To keep as little data as possible, we delete unused profiles after 12 months — including the learning plan and lessons.\n\n` +
          `To keep it, start a lesson or open the profile before then: ${base}/dashboard/children\n`,
      }).catch(() => undefined);
      await db.update(childProfiles).set({ retentionNoticeAt: now }).where(eq(childProfiles.id, p.id));
    }
  }

  const expired = and(
    lt(childProfiles.lastActiveAt, monthsAgo(DELETE_MONTHS, now)),
    isNotNull(childProfiles.retentionNoticeAt),
    lt(childProfiles.retentionNoticeAt, daysAgo(NOTICE_GRACE_DAYS, now)),
  );
  const toDelete = await db.select({ id: childProfiles.id }).from(childProfiles).where(expired);
  if (!dryRun && toDelete.length) await db.delete(childProfiles).where(expired);

  return { lessonsDeleted: lessons.length, noticesSent: toNotify.length, profilesDeleted: toDelete.length, dryRun };
}
