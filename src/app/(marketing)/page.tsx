import Link from 'next/link';
import { ArrowRight, Bolt, MessageSquare, Users } from 'lucide-react';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, creditPacks, personaCategories, personas, personaVersions, posts } from '@/db/schema';
import { PersonaCard } from '@/components/site/persona-card';
import { PricingCard } from '@/components/site/pricing-card';
import { Badge } from '@/components/ui/badge';
import { formatCredits, formatDate, truncate } from '@/lib/utils';
import { getSettingInt, getSettingString } from '@/lib/settings';
import { getFrontendT } from '@/lib/i18n/translate';

export const revalidate = 300;

export default async function HomePage() {
  const [
    featured,
    categoryRows,
    packs,
    latestPosts,
    stats,
    signupBonus,
    heroTitleRaw,
    heroSubtitle,
    heroPrimaryLabel,
    heroSecondaryLabel,
    ctaTitle,
    ctaSubtitleRaw,
    ctaButtonLabel,
    { t },
  ] = await Promise.all([
    db
      .select({ persona: personas, audienceType: personaVersions.audienceType })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(and(eq(personas.isActive, true), eq(personas.isFeatured, true)))
      .orderBy(personas.position)
      .limit(8)
      .then((rows) => rows.map((r) => ({ ...r.persona, audienceType: r.audienceType }))),
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        color: categories.color,
        count: sql<number>`count(${personaCategories.personaId})::int`,
      })
      .from(categories)
      .leftJoin(personaCategories, eq(personaCategories.categoryId, categories.id))
      .where(eq(categories.isActive, true))
      .groupBy(categories.id)
      .orderBy(categories.position)
      .limit(12),
    db.select().from(creditPacks).where(eq(creditPacks.isActive, true)).orderBy(creditPacks.position).limit(3),
    db
      .select()
      .from(posts)
      .where(eq(posts.isPublished, true))
      .orderBy(desc(posts.publishedAt))
      .limit(3),
    db
      .select({
        personas: sql<number>`count(*) filter (where ${personas.isActive})::int`,
        messages: sql<number>`coalesce(sum(${personas.messagesCount}), 0)::int`,
      })
      .from(personas),
    getSettingInt('signup_bonus_credits', 250),
    getSettingString('hero_title', 'Your AI agency, ||staffed by personas'),
    getSettingString(
      'hero_subtitle',
      'Hire a specialist for every task — a maths tutor, a copywriter, a strategist. Each one has its own expertise, personality and teaching level. Pay only for what you use.',
    ),
    getSettingString('hero_primary_label', 'Browse personas'),
    getSettingString('hero_secondary_label', 'See pricing'),
    getSettingString('cta_title', 'Start with free credits'),
    getSettingString(
      'cta_subtitle',
      'Create an account and get {credits} credits to try every persona — no card required.',
    ),
    getSettingString('cta_button_label', 'Create free account'),
    getFrontendT(),
  ]);

  const totals = stats[0] ?? { personas: 0, messages: 0 };
  const [heroTitleLead, heroTitleAccent] = heroTitleRaw.split('||');

  return (
    <>
      {/* ============================== HERO ============================== */}
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
              {heroTitleLead}
              {heroTitleAccent ? (
                <span className="glow-text bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
                  {heroTitleAccent}
                </span>
              ) : null}
            </h1>

            <p className="animate-in-up mx-auto mt-6 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-300">
              {heroSubtitle}
            </p>

            <div className="animate-in-up mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/personas"
                className="glow-btn inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-semibold text-white transition hover:bg-brand-700"
              >
                {heroPrimaryLabel}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                {heroSecondaryLabel}
              </Link>
            </div>

            <dl className="animate-in-up mx-auto mt-14 grid max-w-lg grid-cols-3 gap-6 text-center">
              {[
                { label: t('home.stat_personas', 'Personas'), value: String(totals.personas) },
                { label: t('home.stat_messages', 'Messages'), value: formatCredits(totals.messages) },
                { label: t('home.stat_categories', 'Categories'), value: String(categoryRows.length) },
              ].map((stat) => (
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

      {/* =========================== CATEGORIES =========================== */}
      {categoryRows.length > 0 ? (
        <section className="container-app pb-6">
          <div className="flex flex-wrap justify-center gap-2">
            {categoryRows.map((category) => (
              <Link
                key={category.id}
                href={`/personas?category=${category.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-500/10"
              >
                <span className="size-2 rounded-full" style={{ background: category.color ?? '#6366f1' }} />
                {category.name}
                <span className="text-xs text-slate-400">{category.count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ============================ FEATURED ============================ */}
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
            {t('home.no_personas', 'No personas yet — run')} <code className="font-mono">npm run db:seed</code> {t('home.no_personas_2', 'or add one in the admin panel.')}
          </p>
        )}
      </section>

      {/* ========================== HOW IT WORKS ========================== */}
      <section className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.how_title', 'Three steps, no setup')}</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              {t('home.how_subtitle', 'No prompt engineering, no configuration files. Pick someone and start talking.')}
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: t('home.step1_title', 'Pick a persona'),
                body: t('home.step1_body', 'Each persona carries its own expertise, tone and teaching level — from early years to professional.'),
              },
              {
                icon: MessageSquare,
                title: t('home.step2_title', 'Talk naturally'),
                body: t('home.step2_body', 'Replies stream in as they are written. Adjust tone, format and length mid-conversation.'),
              },
              {
                icon: Bolt,
                title: t('home.step3_title', 'Pay per use'),
                body: t('home.step3_body', 'Credits are deducted per message based on real token usage. No subscription, no lock-in.'),
              },
            ].map((step) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <step.icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= PRICING ============================ */}
      {packs.length > 0 ? (
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
      ) : null}

      {/* ============================== BLOG ============================== */}
      {latestPosts.length > 0 ? (
        <section className="container-app pb-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.blog_title', 'From the blog')}</h2>
            <Link href="/blog" className="text-sm font-semibold text-brand-600 hover:underline">
              {t('home.blog_all', 'All posts →')}
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {latestPosts.map((post) => (
              <article
                key={post.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="aurora h-40 w-full" />
                <div className="p-5">
                  <p className="text-xs text-slate-400">
                    {formatDate(post.publishedAt)} · {t('home.min_read', '{minutes} min read', { minutes: post.readingMinutes })}
                  </p>
                  <h3 className="mt-2 font-semibold leading-snug">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {truncate(post.excerpt, 120)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* =============================== CTA ============================== */}
      <section className="container-app pb-24">
        <div className="glow-ring relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-16 text-center text-white sm:px-16">
          <div className="grid-fade absolute inset-0 opacity-20" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{ctaTitle}</h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">
              {ctaSubtitleRaw.replace('{credits}', formatCredits(signupBonus))}
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              {ctaButtonLabel}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
