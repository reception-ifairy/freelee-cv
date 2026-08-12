'use client';

import { Ban, CircleCheck, User, Users } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { Meter } from '@/components/ui/meter';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { toggleUserActiveAction } from '@/server/actions/admin';

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** Formatted for display. `creditsValue` carries the raw number the meter scales against. */
  credits: string;
  creditsValue: number;
  chatCount: number;
  isActive: boolean;
  isAdmin: boolean;
  joined: string;
};

export function CustomersList({ rows, view }: { rows: CustomerRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  // Shared scales, so the bars rank customers against each other rather than
  // each filling its own row.
  const topCredits = Math.max(1, ...rows.map((r) => r.creditsValue));
  const topChats = Math.max(1, ...rows.map((r) => r.chatCount));

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.email,
    href: `/admin/customers/${row.id}`,
    media: (
      <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-on-brand">
        {row.initials}
      </span>
    ),
    badges: [
      { label: row.isActive ? 'Active' : 'Suspended', tone: row.isActive ? ('green' as const) : ('rose' as const) },
      ...(row.isAdmin ? [{ label: 'Admin', tone: 'brand' as const }] : []),
    ],
    meta: [
      // Credits and chats are the two figures this screen exists to compare —
      // who is running out, who is actually using the product — and both were
      // bare text at the same weight as the join date.
      { label: 'Credits', value: <Meter value={row.creditsValue} max={topCredits} tone="emerald" display={row.credits} label="Credits" /> },
      { label: 'Chats', value: <Meter value={row.chatCount} max={topChats} display={row.chatCount.toLocaleString('en-GB')} label="Chats" /> },
      { label: 'Joined', value: row.joined },
    ],
    actions: [
      { label: 'Open customer', href: `/admin/customers/${row.id}`, icon: <User className="size-4" /> },
      {
        label: row.isActive ? 'Suspend account' : 'Restore account',
        icon: row.isActive ? <Ban className="size-4" /> : <CircleCheck className="size-4" />,
        onSelect: () => run(toggleUserActiveAction, { id: row.id }),
        danger: row.isActive,
        separated: true,
      },
    ],
  }));

  return <ResourceView module="customers" view={view} items={items} empty={{ icon: Users, title: 'No customers yet', description: 'Anyone who signs up appears here with their credit balance and conversation count.' }} columns={3} showCount={false} />;
}
