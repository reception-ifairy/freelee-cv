'use client';

import { CircleCheck, Mail, Phone, Trash2, UserRoundCheck } from 'lucide-react';
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

export function LeadsList({ rows, view }: { rows: LeadRowData[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name || row.email || row.phone || 'Someone',
    subtitle: row.note,
    badges: [
      { label: row.status, tone: STATUS_TONE[row.status] ?? 'slate' },
      { label: LEAD_KIND_LABELS[row.kind] ?? row.kind, tone: 'slate' as const },
    ],
    meta: [
      { label: 'Contact', value: row.email ?? row.phone ?? '—' },
      { label: 'Asked', value: row.created },
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
      empty="No one has used the quick actions yet. Turn them on in Settings → Site assistant."
      columns={3}
    />
  );
}
