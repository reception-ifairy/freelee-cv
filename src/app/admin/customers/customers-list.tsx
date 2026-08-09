'use client';

import { Ban, CircleCheck, User } from 'lucide-react';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { toggleUserActiveAction } from '@/server/actions/admin';

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  credits: string;
  chatCount: number;
  isActive: boolean;
  isAdmin: boolean;
  joined: string;
};

export function CustomersList({ rows, view }: { rows: CustomerRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.email,
    href: `/admin/customers/${row.id}`,
    media: (
      <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {row.initials}
      </span>
    ),
    badges: [
      { label: row.isActive ? 'Active' : 'Suspended', tone: row.isActive ? ('green' as const) : ('rose' as const) },
      ...(row.isAdmin ? [{ label: 'Admin', tone: 'brand' as const }] : []),
    ],
    meta: [
      { label: 'Credits', value: row.credits },
      { label: 'Chats', value: row.chatCount },
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

  return <ResourceView module="customers" view={view} items={items} empty="No customers yet." columns={3} />;
}
