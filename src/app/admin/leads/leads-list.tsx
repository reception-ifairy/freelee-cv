'use client';

import { CircleCheck, Inbox, Mail, Phone, Trash2, UserRoundCheck } from 'lucide-react';
import { ResourceView, type ResourceItem, type BadgeTone } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { deleteLeadAction, setLeadStatusAction } from '@/server/actions/leads';
import { LEAD_KIND_LABELS } from '@/lib/leads/catalog';

export type LeadRowData = {
  id: number;
  kind: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  status: string;
  personaName: string | null;
  created: string;
};

const STATUS_TONE: Record<string, BadgeTone> = { new: 'brand', contacted: 'amber', closed: 'slate' };
const STATUS_LABELS: Record<string, string> = { new: 'Waiting', contacted: 'Contacted', closed: 'Closed' };

export function LeadsList({ rows, view }: { rows: LeadRowData[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name || row.email || row.phone || 'Someone',
    subtitle: row.note,
    badges: [
      // Title-cased. The raw column values are `new`/`contacted`/`closed`, and
      // printing a database enum straight into the UI was the one place this
      // list showed its plumbing — right beside LEAD_KIND_LABELS, which does
      // exactly this translation for the other badge.
      { label: STATUS_LABELS[row.status] ?? row.status, tone: STATUS_TONE[row.status] ?? 'slate' },
      { label: LEAD_KIND_LABELS[row.kind] ?? row.kind, tone: 'slate' as const },
    ],
    meta: [
      { label: 'Contact', value: row.email ?? row.phone ?? '—' },
      { label: 'Asked', value: row.created },
      // Joined in the query and mapped all the way into the row, then never
      // rendered. Which persona produced a lead is how you tell a trial
      // request from the pricing bot apart from one from the support bot.
      ...(row.personaName ? [{ label: 'From', value: row.personaName }] : []),
    ],
    actions: [
      // A lead is a person waiting; the reply route comes first.
      ...(row.email ? [{ label: `Email ${row.email}`, href: `mailto:${row.email}`, icon: <Mail className="size-4" /> }] : []),
      ...(row.phone ? [{ label: `Call ${row.phone}`, href: `tel:${row.phone}`, icon: <Phone className="size-4" /> }] : []),
      {
        label: 'Mark as contacted', icon: <UserRoundCheck className="size-4" />, separated: true,
        disabled: row.status === 'contacted',
        onSelect: () => run(setLeadStatusAction, { id: row.id, status: 'contacted' }),
      },
      {
        label: 'Mark as closed', icon: <CircleCheck className="size-4" />,
        disabled: row.status === 'closed',
        onSelect: () => run(setLeadStatusAction, { id: row.id, status: 'closed' }),
      },
      {
        label: 'Delete', icon: <Trash2 className="size-4" />, danger: true, separated: true,
        onSelect: () => run(deleteLeadAction, { id: row.id }),
      },
    ],
  }));

  return (
    <ResourceView
      module="leads"
      view={view}
      items={items}
      empty={{ icon: Inbox, title: 'No leads yet', description: 'When somebody uses a quick action in the site assistant — a trial, a callback, a pricing question — they land here.' }}
      columns={3}
    />
  );
}
