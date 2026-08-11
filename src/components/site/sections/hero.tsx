import Link from 'next/link';
import { ArrowRight, Bolt } from 'lucide-react';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { personas, categories } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { formatCredits } from '@/lib/utils';
import { getFrontendT } from '@/lib/i18n/translate';
import { EditorialHero } from './hero-editorial';
import type { HeroConfig } from './types';

export async function HeroSection({ config }: { config: HeroConfig }) {
  const [[stats], [categoryCount], { t }] = await Promise.all([
    db
      .select({
        personas: sql<number>`count(*) filter (where ${personas.isActive})::int`,
        messages: sql<number>`coalesce(sum(${personas.messagesCount}), 0)::int`,
      })
      .from(personas),
    db.select({ count: sql<number>`count(*)::int` }).from(categories).where(eq(categories.isActive, true)),
    getFrontendT(),
  ]);

  const totals = stats ?? { personas: 0, messages: 0 };

  const statList = [
    { label: t('home.stat_personas', 'Personas'), value: String(totals.personas) },
    { label: t('home.stat_messages', 'Messages'), value: formatCredits(totals.messages) },
    { label: t('home.stat_categories', 'Categories'), value: String(categoryCount?.count ?? 0) },
  ];

  // Two hero designs, chosen in the builder. The editorial one is adapted from
  // the SovereignAI marketplace — see docs/41-sovereign-and-hub.md.
  if ((config as { variant?: string }).variant === 'editorial') {
    return <EditorialHero config={config} stats={statList} />;
  }

  return (
    <section className="relative overflow-hidden">
      <div className="aurora absolute inset-0 -z-10" />
      <div className="grid-fade absolute inset-0 -z-10" />

      <div className="container-app py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="brand" className="animate-in-up">
            <Bolt className="size-3.5" />
            {t('home.hero_badge', '{count} AI specialists ready to work', { count: totals.personas })}
          </Badge>

          <h1 className="animate-in-up mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {config.titleLead}
            {config.titleAccent ? (
              <span className="glow-text bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
                {config.titleAccent}
              </span>
            ) : null}
          </h1>

          <p className="animate-in-up mx-auto mt-6 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-300">
            {config.subtitle}
          </p>

          <div className="animate-in-up mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/personas"
              className="glow-btn inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-semibold text-on-brand transition hover:bg-brand-700"
            >
              {config.primaryLabel}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              {config.secondaryLabel}
            </Link>
          </div>

          <dl className="animate-in-up mx-auto mt-14 grid max-w-lg grid-cols-3 gap-6 text-center">
            {statList.map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-bold tracking-tight sm:text-3xl">{stat.value}</dt>
                <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
