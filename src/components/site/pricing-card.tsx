import Link from 'next/link';
import { Check } from 'lucide-react';
import type { CreditPack } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { checkoutAction } from '@/server/actions/billing';
import { cn, formatMoney } from '@/lib/utils';

type Gateway = { id: string; label: string };

type Props = {
  pack: CreditPack;
  gateways: Gateway[];
  /** Signed-out visitors are sent to registration instead of checkout. */
  isAuthenticated?: boolean;
};

export function PricingCard({ pack, gateways, isAuthenticated = false }: Props) {
  const total = pack.credits + pack.bonusCredits;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900',
        pack.isFeatured
          ? 'border-brand-500 shadow-lg ring-2 ring-brand-500'
          : 'border-slate-200/80 dark:border-slate-800',
      )}
    >
      {pack.badge || pack.isFeatured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-on-brand">
          {pack.badge ?? 'Most popular'}
        </span>
      ) : null}

      <h3 className="text-lg font-semibold">{pack.name}</h3>
      {pack.description ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pack.description}</p>
      ) : null}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight">
          {formatMoney(pack.priceCents, pack.currency)}
        </span>
        {pack.compareAtCents ? (
          <span className="text-sm text-slate-400 line-through">
            {formatMoney(pack.compareAtCents, pack.currency)}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
        {pack.credits.toLocaleString('en-US')} credits
        {pack.bonusCredits > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {' '}
            + {pack.bonusCredits.toLocaleString('en-US')} bonus
          </span>
        ) : null}
      </p>

      {pack.features.length > 0 ? (
        <ul className="mt-6 space-y-2.5 text-sm">
          {pack.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-6">
        {isAuthenticated && gateways.length > 0 ? (
          <form action={checkoutAction} className="space-y-2">
            <input type="hidden" name="packSlug" value={pack.slug} />

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
              className={cn(
                'h-10 w-full rounded-xl text-sm font-semibold transition',
                pack.isFeatured
                  ? 'bg-brand-600 text-on-brand hover:bg-brand-700'
                  : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              )}
            >
              Buy {total.toLocaleString('en-US')} credits
            </button>
          </form>
        ) : (
          <Link
            href={isAuthenticated ? '/pricing' : '/register'}
            className={cn(
              'flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition',
              pack.isFeatured
                ? 'bg-brand-600 text-on-brand hover:bg-brand-700'
                : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
            )}
          >
            {isAuthenticated ? 'View options' : 'Get started'}
          </Link>
        )}
      </div>
    </div>
  );
}
