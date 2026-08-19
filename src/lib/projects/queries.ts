import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { projects, chats, conversations, creditTransactions } from '@/db/schema';
import { crews } from '@/modules/crews/schema';

/**
 * Read-side queries for projects.
 *
 * Deliberately NOT in `server/actions/admin-projects.ts`: **every export from a
 * `'use server'` file is a callable HTTP endpoint**, so a query living there is
 * a public API whether you meant it or not. This codebase has been bitten twice
 * — `listPromotableMessages` once exposed customer messages that way.
 */

/**
 * What a project actually contains, and what it has cost.
 *
 * Spend comes from `credit_transactions.meta->>'projectId'` rather than the
 * cached `projects.credits_spent`, because the ledger is the source of truth
 * and a cache that disagrees with it is worse than no cache.
 */
export async function projectTotals(projectId: string) {
  const [row] = await db
    .select({
      chats: sql<number>`(select count(*)::int from ${chats} where ${chats.projectId} = ${projectId})`,
      rooms: sql<number>`(select count(*)::int from ${conversations} where ${conversations.projectId} = ${projectId})`,
      crews: sql<number>`(select count(*)::int from ${crews} where ${crews.projectId} = ${projectId})`,
      spent: sql<number>`(select coalesce(sum(abs(${creditTransactions.amount})), 0)::int
                          from ${creditTransactions}
                          where ${creditTransactions.type} = 'spend'
                            and ${creditTransactions.meta}->>'projectId' = ${projectId})`,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return row ?? { chats: 0, rooms: 0, crews: 0, spent: 0 };
}
