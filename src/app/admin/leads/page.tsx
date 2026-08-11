import type { Metadata } from 'next';
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { leads, personas } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { formatDate } from '@/lib/utils';
import { LeadsList, type LeadRowData } from './leads-list';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leads' };

export default async function AdminLeadsPage() {
  const [rows, view] = await Promise.all([
    db
      .select({ lead: leads, personaName: personas.name })
      .from(leads)
      .leftJoin(personas, eq(personas.id, leads.personaId))
      .orderBy(desc(leads.createdAt))
      .limit(200),
    getAdminView('leads', 'list'),
  ]);

  const items: LeadRowData[] = rows.map(({ lead, personaName }) => ({
    id: lead.id,
    kind: lead.kind,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    note: lead.note,
    status: lead.status,
    personaName,
    created: formatDate(lead.createdAt),
  }));

  const waiting = items.filter((item) => item.status === 'new').length;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="People who asked to be contacted through the assistant's quick actions. See docs/41-assistant-hub.md."
      />

      {waiting > 0 ? (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
          {waiting} {waiting === 1 ? 'person is' : 'people are'} waiting for a reply.
        </p>
      ) : null}

      <LeadsList rows={items} view={view} />

      <p className="mt-4 text-xs text-slate-400">
        Quick actions are switched on in{' '}
        <Link href="/admin/settings?section=assistant" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Settings → Site assistant
        </Link>
        .
      </p>
    </div>
  );
}
