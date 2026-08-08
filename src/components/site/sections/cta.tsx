import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSettingInt } from '@/lib/settings';
import { formatCredits } from '@/lib/utils';
import type { CtaConfig } from './types';

export async function CtaSection({ config }: { config: CtaConfig }) {
  const signupBonus = await getSettingInt('signup_bonus_credits', 250);

  return (
    <section className="container-app pb-24">
      <div className="glow-ring relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-16 text-center text-white sm:px-16">
        <div className="grid-fade absolute inset-0 opacity-20" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{config.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">
            {config.subtitle.replace('{credits}', formatCredits(signupBonus))}
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            {config.buttonLabel}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
