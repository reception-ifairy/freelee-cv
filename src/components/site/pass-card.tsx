import Link from 'next/link';
import type { PassProduct } from '@/db/schema';
import { buyPassAction } from '@/server/actions/billing';
import { formatMoney } from '@/lib/utils';

type Gateway = { id: string; label: string };

type Props = { pass: PassProduct; gateways: Gateway[]; isAuthenticated?: boolean };

export function PassCard({ pass, gateways, isAuthenticated = false }: Props) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-lg font-semibold">{pass.name}</h3>
      {pass.description ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pass.description}</p>
      ) : null}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight">{formatMoney(pass.priceCents, pass.currency)}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
        {pass.durationValue} {pass.durationUnit}
        {pass.durationValue > 1 ? 's' : ''} of unmetered chat access
      </p>

      <div className="mt-auto pt-6">
        {isAuthenticated && gateways.length > 0 ? (
          <form action={buyPassAction} className="space-y-2">
            <input type="hidden" name="passKey" value={pass.key} />
            {gateways.length > 1 ? (
              <select
                name="gateway"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                aria-label="Payment method"
              >
                {gateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gateway.label}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="gateway" value={gateways[0]?.id ?? 'stripe'} />
            )}
            <button
              type="submit"
              className="h-10 w-full rounded-xl border border-slate-200 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Buy pass
            </button>
          </form>
        ) : (
          <Link
            href="/register"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Get started
          </Link>
        )}
      </div>
    </div>
  );
}
