import { getFrontendT } from '@/lib/i18n/translate';
import { BlockIcon } from '@/components/ui/block-icon';
import type { HowItWorksConfig } from './types';

export async function HowItWorksSection({ config }: { config: HowItWorksConfig }) {
  if (config.steps.length === 0) return null;
  const { t } = await getFrontendT();

  return (
    <section className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="container-app">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.how_title', 'Three steps, no setup')}</h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {t('home.how_subtitle', 'No prompt engineering, no configuration files. Pick someone and start talking.')}
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {config.steps.map((step, i) => {
            return (
              <div key={`${step.title}-${i}`} className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <BlockIcon name={step.icon} className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
