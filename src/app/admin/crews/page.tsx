import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { crews, crewMembers, crewRuns } from '@/modules/crews/schema';
import { PageHeader } from '@/components/admin/page-header';
import { buttonVariants } from '@/components/ui/button';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { CrewsList, type CrewRowData } from './crews-list';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bot teams' };

/**
 * The list, and one obvious way to make a new team.
 *
 * The create form used to sit beside the list — ten controls, including a
 * checkbox list of every persona — so the first thing this screen asked of
 * anyone was the hardest thing in the feature. It is a button to
 * `/admin/crews/new` now.
 */
export default async function AdminCrewsPage() {
  const [rows, view] = await Promise.all([
    db
      .select({
        id: crews.id,
        name: crews.name,
        description: crews.description,
        mode: crews.mode,
        isActive: crews.isActive,
        projectName: projects.name,
        // Correlated subqueries, explicitly qualified — see the comment in
        // /admin/projects/page.tsx about what an unqualified "id" does inside
        // one of these.
        memberCount: sql<number>`(select count(*)::int from ${crewMembers} where ${crewMembers.crewId} = ${sql.raw('"crews"."id"')})`,
        runCount: sql<number>`(select count(*)::int from ${crewRuns} where ${crewRuns.crewId} = ${sql.raw('"crews"."id"')})`,
        lastRunStatus: sql<string | null>`(select status::text from ${crewRuns} where ${crewRuns.crewId} = ${sql.raw('"crews"."id"')} order by created_at desc limit 1)`,
        // The status alone cannot say *why* a run stopped — see runOutcome.
        lastRunStopReason: sql<string | null>`(select stop_reason from ${crewRuns} where ${crewRuns.crewId} = ${sql.raw('"crews"."id"')} order by created_at desc limit 1)`,
      })
      .from(crews)
      .leftJoin(projects, eq(projects.id, crews.projectId))
      .orderBy(desc(crews.createdAt)),
    getAdminView('crews'),
  ]);

  return (
    <div>
      <PageHeader
        title="Bot teams"
        description="A few bots working on one task together — taking turns, answering side by side, or with a lead bot handing out the work."
        actions={
          <Link href="/admin/crews/new" className={buttonVariants()}>
            <Plus /> New bot team
          </Link>
        }
      />

      <CrewsList rows={rows as CrewRowData[]} view={view} />
    </div>
  );
}
