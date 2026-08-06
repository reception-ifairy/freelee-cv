import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageSquare, Zap } from 'lucide-react';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions } from '@/db/schema';
import { PersonaCard } from '@/components/site/persona-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { startChatAction } from '@/server/actions/chat';
import { AUDIENCE_TYPES, type AudienceTypeId } from '@/lib/persona/prompt';
import { getProviderRegistry, resolveProviderId } from '@/lib/ai/registry';
import { formatCredits, initialsOf, truncate } from '@/lib/utils';

type Params = Promise<{ slug: string }>;

async function loadPersona(slug: string) {
  const [row] = await db
    .select({ persona: personas, version: personaVersions })
    .from(personas)
    .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
    .where(and(eq(personas.slug, slug), eq(personas.isActive, true)))
    .limit(1);

  return row ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadPersona(slug);
  if (!row) return { title: 'Persona not found' };

  return {
    title: row.persona.name,
    description: truncate(row.persona.tagline ?? row.persona.description, 158),
    openGraph: { title: row.persona.name, description: row.persona.tagline ?? undefined },
  };
}

export default async function PersonaPage({ params }: { params: Params }) {
  const { slug } = await params;
  const row = await loadPersona(slug);
  if (!row) notFound();
  const { persona, version } = row;
  if (!version) notFound(); // shouldn't happen post-backfill — a persona with no current version isn't showable

  const [personaCats, relatedRows] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(personaCategories)
      .innerJoin(categories, eq(categories.id, personaCategories.categoryId))
      .where(eq(personaCategories.personaId, persona.id)),
    db
      .select({ persona: personas, audienceType: personaVersions.audienceType })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .where(
        and(
          eq(personas.isActive, true),
          ne(personas.id, persona.id),
          sql`exists (
            select 1 from ${personaCategories} pc
            where pc.persona_id = ${personas.id}
              and pc.category_id in (
                select category_id from ${personaCategories} where persona_id = ${persona.id}
              )
          )`,
        ),
      )
      .limit(4),
  ]);
  const related = relatedRows.map((r) => ({ ...r.persona, audienceType: r.audienceType }));

  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(version.aiProvider);
  const model = version.model ?? registry[providerId].defaultModel;
  const traits = Object.entries(version.personality);

  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: `linear-gradient(135deg, ${persona.accentColor}20, transparent 60%)` }}
        />

        <div className="container-app py-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div
              className="grid size-28 shrink-0 place-items-center rounded-3xl border-4 border-white text-3xl font-bold text-white shadow-lg dark:border-slate-900"
              style={{ background: persona.accentColor }}
              aria-hidden="true"
            >
              {initialsOf(persona.name)}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{persona.name}</h1>
                {persona.isPremium ? <Badge tone="amber">Premium</Badge> : null}
                {version.audienceType ? (
                  <Badge>{AUDIENCE_TYPES[version.audienceType as AudienceTypeId]?.label ?? version.audienceType}</Badge>
                ) : null}
              </div>

              {persona.expertise ? (
                <p className="mt-1.5 font-medium text-brand-600 dark:text-brand-400">{persona.expertise}</p>
              ) : null}

              <p className="mt-4 max-w-2xl text-pretty text-slate-600 dark:text-slate-300">
                {persona.description ?? persona.tagline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <form action={startChatAction}>
                  <input type="hidden" name="persona" value={persona.slug} />
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-semibold text-white transition hover:bg-brand-700"
                  >
                    <MessageSquare className="size-4" />
                    Start a conversation
                  </button>
                </form>

                <Badge>
                  <Zap className="size-3.5" />
                  {persona.creditsPerMessage > 0
                    ? `${persona.creditsPerMessage} credits / message`
                    : 'Metered by token usage'}
                </Badge>
              </div>

              {personaCats.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {personaCats.map((category) => (
                    <Link key={category.slug} href={`/personas?category=${category.slug}`}>
                      <Badge tone="brand">{category.name}</Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container-app grid gap-10 py-12 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {version.welcomeMessage ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How it opens</h2>
              <p className="mt-3 text-slate-700 dark:text-slate-200">{version.welcomeMessage}</p>
            </Card>
          ) : null}

          {version.suggestions.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Try asking</h2>
              <ul className="mt-4 space-y-2">
                {version.suggestions.map((suggestion) => (
                  <li
                    key={suggestion}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {version.knowledgeDomains.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Knowledge domains
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {version.knowledgeDomains.map((domain) => (
                  <Badge key={domain}>{domain}</Badge>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          {traits.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Personality</h2>
              <dl className="mt-4 space-y-3">
                {traits.map(([trait, value]) => (
                  <div key={trait}>
                    <div className="flex justify-between text-xs">
                      <dt className="font-medium capitalize">{trait}</dt>
                      <dd className="text-slate-400">{value}</dd>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${value ?? 0}%` }} />
                    </div>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stats</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Conversations</dt>
                <dd className="font-semibold">{formatCredits(persona.chatsCount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Messages</dt>
                <dd className="font-semibold">{formatCredits(persona.messagesCount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Model</dt>
                <dd className="font-mono text-xs">{model}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </section>

      {related.length > 0 ? (
        <section className="container-app pb-20">
          <h2 className="mb-6 text-xl font-bold tracking-tight">Similar personas</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <PersonaCard key={item.id} persona={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
