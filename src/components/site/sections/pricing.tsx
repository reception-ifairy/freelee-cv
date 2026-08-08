import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { creditPacks } from '@/db/schema';
import { PricingCard } from '@/components/site/pricing-card';
import { getFrontendT } from '@/lib/i18n/translate';

export async function PricingSection() {
  const [packs, { t }] = await Promise.all([
    db.select().from(creditPacks).where(eq(creditPacks.isActive, true)).orderBy(creditPacks.position).limit(3),
    getFrontendT(),
  ]);

  if (packs.length === 0) return null;

  return (
    <section className="container-app py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.pricing_title', 'Simple credit packs')}</h2>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          {t('home.pricing_subtitle', 'Buy once, spend whenever. Credits never expire.')}
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {packs.map((pack) => (
          <PricingCard key={pack.id} pack={pack} gateways={[]} />
        ))}
      </div>
    </section>
  );
}
