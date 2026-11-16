'use client';

import { Ban, Check, Store, X } from 'lucide-react';
import { ResourceView, type BadgeTone, type ResourceItem } from '@/components/admin/resource-view';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { approveListingAction, rejectListingAction, suspendListingAction } from '@/server/actions/admin-marketplace';

export type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  vendor: string;
  persona: string | null;
  pricingModel: string;
  installs: number;
  submitted: string;
  moderatorNote: string | null;
};

/** The words for `listing_status`; Approved reads as Live, because that is what it means to a customer. */
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending_review: { label: 'Pending review', tone: 'amber' },
  approved: { label: 'Live', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'rose' },
  suspended: { label: 'Suspended', tone: 'rose' },
  draft: { label: 'Draft', tone: 'slate' },
};

/**
 * Vendor listings in the taxonomy's layout (freelee #91): every status on the
 * left — pending review first, the queue this screen exists for — and each
 * listing's card with what can be done to it. Until #91 the screen showed only
 * the pending and the live ones; rejected and suspended listings could not be
 * found again.
 */
export function ListingsList({ rows, before }: { rows: ListingRow[]; before: React.ReactNode }) {
  const { run } = useAdminAction();

  const items: ResourceItem[] = rows.map((row) => {
    const status = STATUS[row.status] ?? { label: row.status, tone: 'slate' as const };
    return {
      id: row.id,
      title: row.title,
      subtitle: `by ${row.vendor}${row.persona ? ` · bot: ${row.persona}` : ''}`,
      badges: [{ label: status.label, tone: status.tone }],
      meta: [
        { label: 'Installs', value: row.installs.toLocaleString('en-GB') },
        { label: 'Submitted', value: row.submitted },
        { label: 'Pricing', value: row.pricingModel.replace(/_/g, ' '), cardOnly: true },
        ...(row.description ? [{ label: 'Description', value: row.description, cardOnly: true }] : []),
        ...(row.moderatorNote ? [{ label: 'Moderator note', value: row.moderatorNote, cardOnly: true }] : []),
      ],
      actions: [
        ...(row.status === 'pending_review'
          ? [
              { label: 'Approve', icon: <Check className="size-4" />, onSelect: () => run(approveListingAction, { listingId: row.id }) },
              {
                label: 'Reject',
                icon: <X className="size-4" />,
                danger: true,
                onSelect: () => run(rejectListingAction, { listingId: row.id, moderatorNote: 'Rejected by moderator.' }),
              },
            ]
          : []),
        ...(row.status === 'approved'
          ? [{ label: 'Suspend', icon: <Ban className="size-4" />, danger: true, onSelect: () => run(suspendListingAction, { listingId: row.id }) }]
          : []),
      ],
    };
  });

  return (
    <ResourceView
      module="marketplace"
      view="list"
      browser={{ groups: ['Pending review', 'Live', 'Suspended', 'Rejected', 'Draft'], railLabel: 'Status', before }}
      items={items}
      empty={{
        icon: Store,
        title: 'No listings here',
        description: 'When an external vendor submits a bot for the marketplace, it waits here for review.',
      }}
    />
  );
}
