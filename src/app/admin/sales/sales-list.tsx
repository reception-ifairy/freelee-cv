'use client';

import { BadgeCheck, RotateCcw, User } from 'lucide-react';
import { ResourceView, type ResourceItem, type BadgeTone } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import type { AdminView } from '@/lib/admin/view-preference';
import { markOrderPaidAction, refundOrderAction } from '@/server/actions/billing';

export type OrderRow = {
  id: string;
  reference: string;
  userName: string | null;
  userId: string | null;
  packName: string;
  amount: string;
  gateway: string;
  status: string;
  creditsGranted: boolean;
};

const STATUS_TONE: Record<string, BadgeTone> = { paid: 'green', pending: 'amber' };

export function SalesList({ rows, view }: { rows: OrderRow[]; view: AdminView }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => ({
    id: row.id,
    title: row.reference,
    subtitle: `${row.packName} · ${row.userName ?? 'unknown customer'}`,
    badges: [
      { label: row.status, tone: STATUS_TONE[row.status] ?? 'rose' },
      { label: row.gateway, tone: 'slate' as const },
      ...(row.creditsGranted ? [{ label: 'credited', tone: 'slate' as const }] : []),
    ],
    meta: [
      { label: 'Amount', value: row.amount },
      { label: 'Customer', value: row.userName ?? '—' },
    ],
    actions: [
      // Only offered while it can do something — a paid order has nothing to mark.
      {
        label: 'Mark as paid',
        icon: <BadgeCheck className="size-4" />,
        onSelect: () => run(markOrderPaidAction, { orderId: row.id }),
        disabled: row.status !== 'pending',
      },
      ...(row.userId ? [{ label: 'View customer', href: `/admin/customers/${row.userId}`, icon: <User className="size-4" /> }] : []),
      {
        label: 'Refund',
        icon: <RotateCcw className="size-4" />,
        onSelect: () => run(refundOrderAction, { orderId: row.id }),
        disabled: row.status !== 'paid',
        danger: true,
        separated: true,
      },
    ],
  }));

  return <ResourceView module="sales" view={view} items={items} empty="No orders yet." columns={3} />;
}
