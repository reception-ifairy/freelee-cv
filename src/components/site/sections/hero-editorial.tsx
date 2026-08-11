import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HeroConfig } from './types';

export type EditorialHeroProps = {
  config: HeroConfig & { eyebrow?: string; pillars?: { label: string; title: string; body: string }[] };
  stats: { label: string; value: string }[];
};

/**
 * The editorial hero, adapted from the SovereignAI marketplace design.
 *
 * Its language is deliberate and worth naming, because it is the opposite of
 * the standard hero above it: no colour, no gradient, no badge. Authority comes
 * from **scale and restraint** — a very large, very light headline, hairline
 * rules, and micro labels at 10px with half an em of letter-spacing.
 *
 * Two things were changed rather than copied:
 *
 *  - The original hardcodes white on black. Here every colour is a theme token,
 *    so this hero works under any palette — it simply looks its best under the
 *    Sovereign preset, which is what that preset is for.
 *  - The original animates with `motion`. This is a **server component** with
 *    CSS-only reveals, so the hero costs no JavaScript at all. A hero is the
 *    first thing a visitor waits for; a 40KB animation library to fade text in
 *    is a poor trade.
 */
export function EditorialHero({ config, stats }: EditorialHeroProps) {
  const pillars = config.pillars ?? [];

  return (
    <section className="relative overflow-hidden border-b border-slate-200/60 dark:border-white/10">
      <div className="aurora absolute inset-0 -z-10 opacity-40" />
      <div className="grid-fade absolute inset-0 -z-10" />

      <div className="container-app relative py-24 sm:py-32">
        {/* The ghost numeral: enormous, almost invisible, purely structural. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-6 left-0 select-none font-heading text-[120px] font-light leading-none opacity-[0.04] sm:text-[180px]"
        >
          01
        </span>

        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {config.eyebrow ? (
              <p className="animate-in-up text-[10px] font-medium uppercase tracking-[0.5em] text-slate-500 dark:text-slate-400">
                {config.eyebrow}
              </p>
            ) : null}

            <h1 className="animate-in-up mt-6 text-balance text-[44px] font-light leading-[0.95] tracking-tighter sm:text-[64px] lg:text-[76px]">
              {config.titleLead}
              {config.titleAccent ? (
                // The underlight: a hairline that fades out at both ends, which
                // is what carries the emphasis in place of a colour.
                <span className="relative inline-block after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:from-transparent after:via-current after:to-transparent after:opacity-60">
                  {config.titleAccent}
                </span>
              ) : null}
            </h1>

            <p className="animate-in-up mt-8 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              {config.subtitle}
            </p>

            <div className="animate-in-up mt-10 flex flex-wrap gap-3">
              <Link
                href="/personas"
                className="inline-flex h-12 items-center gap-3 rounded-full bg-brand-600 px-7 text-[11px] font-bold uppercase tracking-widest text-on-brand transition hover:bg-brand-700"
              >
                {config.primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center rounded-full border border-slate-300 px-7 text-[11px] font-bold uppercase tracking-widest transition hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/5"
              >
                {config.secondaryLabel}
              </Link>
            </div>

            <div className="animate-in-up mt-12 flex flex-wrap items-center gap-8">
              <span className="flex items-center gap-3">
                {/* Live pulse — the one piece of motion, and it means something. */}
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-brand-600" />
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.3em]">Active ecosystem</span>
              </span>
              <span className="hidden h-px w-24 bg-slate-300 sm:block dark:bg-white/15" />
              <dl className="flex gap-8">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-2xl font-light tracking-tight">{stat.value}</dt>
                    <dd className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Bento column — hairline cards over the page, not solid panels. */}
          {pillars.length > 0 ? (
            <div className="flex flex-col gap-4 lg:col-span-5">
              {pillars.map((pillar, index) => (
                <div
                  key={pillar.title}
                  className="animate-in-up rounded-2xl border border-slate-200/80 bg-white/60 p-7 backdrop-blur-md transition hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/25"
                >
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                    {String(index + 1).padStart(2, '0')} / {pillar.label}
                  </p>
                  <h3 className="mt-4 text-lg font-medium">{pillar.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pillar.body}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
