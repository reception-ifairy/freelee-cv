import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { TeamBuilder } from '@/components/admin/team-builder';
import { loadTeamBuilderOptions } from '../builder-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New bot team' };

/**
 * Its own page rather than the side panel it used to be: a team has three
 * decisions to make and a pool of ~90 bots to choose from, which does not fit
 * in a third of a list page. Same builder as the Build tab, so creating and
 * editing look and behave identically.
 */
export default async function NewCrewPage() {
  const { pool, projects } = await loadTeamBuilderOptions([]);

  return (
    <div>
      <Link
        href="/admin/crews"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> Bot teams
      </Link>

      <PageHeader
        title="New bot team"
        description="A few bots working on one task together. Answer the three questions below, then create the team — you can test it straight after."
      />

      <div className="max-w-4xl">
        <TeamBuilder
          team={{
            name: '',
            description: '',
            mode: 'sequential',
            budgetCredits: 50,
            maxTurns: 6,
            stopConditions: '',
            projectId: '',
            isActive: true,
            members: [],
          }}
          pool={pool}
          projects={projects}
        />
      </div>
    </div>
  );
}
