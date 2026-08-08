import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Markdown } from '@/components/site/markdown';
import type { CustomContentConfig } from './types';

export function CustomContentSection({ config }: { config: CustomContentConfig }) {
  return (
    <section className="container-app py-16">
      <div className={config.imageUrl ? 'grid items-center gap-10 lg:grid-cols-2' : 'mx-auto max-w-2xl text-center'}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{config.heading}</h2>
          <Markdown className="mt-4 text-slate-600 dark:text-slate-300">{config.body}</Markdown>
          {config.ctaLabel && config.ctaHref ? (
            <Link
              href={config.ctaHref}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {config.ctaLabel}
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>
        {config.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, same convention as persona avatars/branding logo
          <img src={config.imageUrl} alt="" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800" />
        ) : null}
      </div>
    </section>
  );
}
