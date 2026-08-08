import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { creditPacks, plans, passProducts } from '@/db/schema';
import { PricingCard } from '@/components/site/pricing-card';
import { PlanCard } from '@/components/site/plan-card';
import { PassCard } from '@/components/site/pass-card';
import { enabledGateways } from '@/lib/billing/gateways';
import { currentUser } from '@/lib/auth';
import { getFrontendT, type Translator } from '@/lib/i18n/translate';
import { helpTopics } from '@/lib/help/topics';
import { HelpTip } from '@/components/ui/help-tip';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Prepaid credits, monthly plans, or a time-boxed pass — pay however suits you.',
};

/** A function of `t`, not a module const — a const would be evaluated before any translator exists. */
const faq = (t: Translator) => [
  {
    q: t('pricing.faq_expiry_q', 'Do credits expire?'),
    a: t('pricing.faq_expiry_a', 'No. Credits stay on your account until you spend them.'),
  },
  {
    q: t('pricing.faq_cost_q', 'How much does a message cost?'),
    a: t('pricing.faq_cost_a', 'It depends on the model and the length of the conversation. A short exchange on a fast model costs a handful of credits; longer context and larger models cost more. Every deduction is itemised in your billing history.'),
  },
  {
    q: t('pricing.faq_refund_q', 'Can I get a refund?'),
    a: t('pricing.faq_refund_a', 'Unused credits can be refunded within 14 days of purchase. Contact support with your order reference.'),
  },
  {
    q: t('pricing.faq_models_q', 'Which AI models do you use?'),
    a: t('pricing.faq_models_a', 'Each persona is configured with a specific model — OpenAI, Anthropic or any OpenAI-compatible provider. The model in use is shown on every persona page.'),
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, packs, activePlans, activePasses, user] = await Promise.all([
    searchParams,
    db.select().from(creditPacks).where(eq(creditPacks.isActive, true)).orderBy(creditPacks.position),
    db.select().from(plans).where(and(eq(plans.isActive, true), eq(plans.isPublic, true))).orderBy(plans.sort),
    db
      .select()
      .from(passProducts)
      .where(and(eq(passProducts.isActive, true), eq(passProducts.isPublic, true)))
      .orderBy(passProducts.sort),
    currentUser(),
  ]);

  const gateways = enabledGateways().map((gateway) => ({ id: gateway.id, label: gateway.label }));
  const { t } = await getFrontendT();
  const help = helpTopics(t);
  const questions = faq(t);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="aurora absolute inset-0 -z-10 opacity-80" />
        <div className="container-app py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t('pricing.title', 'Pay only for what you use')}
          </h1>
          <p className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            {t('pricing.subtitle', 'Credits are deducted per message based on real token usage. No subscription, no expiry, no surprise invoices.')}
            <HelpTip title={help['pricing.credits'].title} body={help['pricing.credits'].body} />
          </p>
        </div>
      </section>

      <section className="container-app pb-12">
        {error ? (
          <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300">
            {error === 'gateway'
              ? t('pricing.error_gateway', 'We could not start the payment. Please try again.')
              : t('pricing.error_generic', 'Something went wrong with that request.')}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packs.length > 0 ? (
            packs.map((pack) => (
              <PricingCard
                key={pack.id}
                pack={pack}
                gateways={gateways}
                isAuthenticated={Boolean(user)}
              />
            ))
          ) : (
            <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
              {t('pricing.empty_packs', 'No credit packs configured yet.')}
            </p>
          )}
        </div>

        {gateways.length === 0 ? (
          <p className="mt-8 text-center text-sm text-amber-600 dark:text-amber-400">
            {t('pricing.no_gateway', 'No payment gateway is configured. Add Stripe or PayPal keys to enable checkout.')}
          </p>
        ) : null}
      </section>

      {activePlans.length > 0 ? (
        <section className="container-app pb-12">
          <h2 className="text-center text-2xl font-bold tracking-tight">{t('pricing.plans_title', 'Prefer a subscription?')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500 dark:text-slate-400">
            {t('pricing.plans_subtitle', 'Recurring credits on a schedule that suits you — weekly, monthly or yearly.')}
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} isAuthenticated={Boolean(user)} />
            ))}
          </div>
        </section>
      ) : null}

      {activePasses.length > 0 ? (
        <section className="container-app pb-12">
          <h2 className="text-center text-2xl font-bold tracking-tight">{t('pricing.passes_title', 'Just need it for a bit?')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500 dark:text-slate-400">
            {t('pricing.passes_subtitle', 'Time-boxed access passes — unmetered chat for an hour, a day, or a week. No ongoing commitment.')}
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activePasses.map((pass) => (
              <PassCard key={pass.id} pass={pass} gateways={gateways} isAuthenticated={Boolean(user)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="container-app pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">{t('pricing.faq_title', 'Questions')}</h2>

          <div className="mt-8 space-y-3">
            {questions.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {item.q}
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
