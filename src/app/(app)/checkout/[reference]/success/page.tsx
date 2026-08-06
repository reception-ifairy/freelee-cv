import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { fulfilOrder } from '@/lib/billing/credits';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Payment complete' };

export default async function CheckoutSuccessPage({
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

  if (!order) notFound();

  // The webhook is the source of truth; this only reconciles what it already did.
  if (order.status === 'paid' && !order.creditsGranted) {
    await fulfilOrder(order.id);
  }

  return (
    <div className="container-app py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
          <Check className="size-8" />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          {order.status === 'paid' ? 'Payment complete' : 'Payment received'}
        </h1>

        <p className="mt-4 text-slate-600 dark:text-slate-300">
          {order.creditsGranted
            ? `${order.credits.toLocaleString('en-US')} credits have been added to your account.`
            : 'We are confirming the payment with the provider. Your credits will appear within a minute — this page does not need to stay open.'}
        </p>

        <Card className="mt-8 space-y-2 p-5 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Reference</span>
            <span className="font-mono">{order.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pack</span>
            <span>{order.packName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span>{formatMoney(order.amountCents, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Credits</span>
            <span>{order.credits.toLocaleString('en-US')}</span>
          </div>
        </Card>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/chat"
            className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start chatting
          </Link>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            View billing
          </Link>
        </div>
      </div>
    </div>
  );
}
