import Link from 'next/link';
import type { Plan } from '@/db/schema';
import { subscribeAction } from '@/server/actions/billing';
import { cn, formatMoney } from '@/lib/utils';

type Props = { plan: Plan; isAuthenticated?: boolean };

export function PlanCard({ plan, isAuthenticated = false }: Props) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      {plan.description ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
      ) : null}

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{formatMoney(plan.priceCents, plan.currency)}</span>
        <span className="text-sm text-slate-400">
          / every {plan.intervalCount > 1 ? `${plan.intervalCount} ` : ''}
          {plan.intervalUnit}
          {plan.intervalCount > 1 ? 's' : ''}
        </span>
      </div>

      {plan.creditsPerCycle > 0 ? (
        <p className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
          {plan.creditsPerCycle.toLocaleString('en-US')} credits every cycle
        </p>
      ) : null}

      <div className="mt-auto pt-6">
        {isAuthenticated ? (
          <form action={subscribeAction}>
            <input type="hidden" name="planKey" value={plan.key} />
            <button
              type="submit"
              className="h-10 w-full rounded-xl border border-slate-200 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Subscribe
            </button>
          </form>
        ) : (
          <Link
            href="/register"
            className={cn(
              'flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition',
              'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
            )}
          >
            Get started
          </Link>
        )}
      </div>
    </div>
  );
}
