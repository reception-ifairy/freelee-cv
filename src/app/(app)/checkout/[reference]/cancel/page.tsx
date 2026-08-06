import type { Metadata } from 'next';
import Link from 'next/link';
import { X } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireUser } from '@/lib/auth';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Checkout cancelled' };

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const [{ reference }, user] = await Promise.all([params, requireUser()]);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.reference, reference), eq(orders.userId, user.id)))
    .limit(1);

  if (order?.status === 'pending') {
    await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id));
  }

  return (
    <div className="container-app py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
          <X className="size-8" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Checkout cancelled</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Nothing was charged{order ? `. Order ${order.reference} has been cancelled` : ''}.
        </p>
        <Link
          href="/pricing"
          className="mt-8 inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to pricing
        </Link>
      </div>
    </div>
  );
}
