import 'server-only';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childPlans, childProfiles, consents } from '@/db/schema';

/**
 * Families in the admin: numbers only, never content (docs/54-children-data.md
 * — the admin must never see a child's profile or plan).
 *
 * Every query here names its columns and aggregates them. None reads `data`
 * (the sealed profile or plan) or `wrapped_key`, none decrypts, and none
 * returns a row per child or per parent. `scripts/verify-tutor-coverage.ts`
 * checks this file for exactly that, so a later edit that reaches for a
 * column it must not fails the build's checks.
 */
export type FamilyCounts = {
  profiles: { total: number; active: number; paused: number; activeLast30: number; newLast30: number; parents: number; retentionNotices: number };
  plans: { total: number; byVersion: { version: string; count: number }[] };
  consents: { kind: string; granted: number; withdrawn: number }[];
};

export async function familyCounts(): Promise<FamilyCounts> {
  const [[profiles], plans, consentRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`(count(*) filter (where ${childProfiles.status} = 'active'))::int`,
        paused: sql<number>`(count(*) filter (where ${childProfiles.status} = 'paused'))::int`,
        activeLast30: sql<number>`(count(*) filter (where ${childProfiles.lastActiveAt} > now() - interval '30 days'))::int`,
        newLast30: sql<number>`(count(*) filter (where ${childProfiles.createdAt} > now() - interval '30 days'))::int`,
        parents: sql<number>`count(distinct ${childProfiles.parentUserId})::int`,
        retentionNotices: sql<number>`(count(*) filter (where ${childProfiles.retentionNoticeAt} is not null))::int`,
      })
      .from(childProfiles),
    db
      .select({ version: childPlans.curriculumVersion, count: sql<number>`count(*)::int` })
      .from(childPlans)
      .groupBy(childPlans.curriculumVersion)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        kind: consents.kind,
        granted: sql<number>`(count(*) filter (where ${consents.withdrawnAt} is null))::int`,
        withdrawn: sql<number>`(count(*) filter (where ${consents.withdrawnAt} is not null))::int`,
      })
      .from(consents)
      .groupBy(consents.kind)
      .orderBy(consents.kind),
  ]);
  return {
    profiles,
    plans: { total: plans.reduce((n, p) => n + p.count, 0), byVersion: plans },
    consents: consentRows,
  };
}
