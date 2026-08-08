import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, personaVersions } from '@/db/schema';
import { PersonaCard } from '@/components/site/persona-card';
import { getFrontendT } from '@/lib/i18n/translate';

export async function FeaturedPersonasSection() {
  const [featured, { t }] = await Promise.all([
    db
      .select({ persona: personas, audienceType: personaVersions.audienceType })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(and(eq(personas.isActive, true), eq(personas.isFeatured, true)))
      .orderBy(personas.position)
      .limit(8)
      .then((rows) => rows.map((r) => ({ ...r.persona, audienceType: r.audienceType }))),
    getFrontendT(),
  ]);

  return (
    <section className="container-app py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.featured_title', 'Featured personas')}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t('home.featured_subtitle', 'Hand-picked specialists to get you started.')}
          </p>
        </div>
        <Link href="/personas" className="text-sm font-semibold text-brand-600 hover:underline">
          {t('home.view_all', 'View all →')}
        </Link>
      </div>

      {featured.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
          {t('home.no_personas', 'No personas yet — run')} <code className="font-mono">npm run db:seed</code>{' '}
          {t('home.no_personas_2', 'or add one in the admin panel.')}
        </p>
      )}
    </section>
  );
}
