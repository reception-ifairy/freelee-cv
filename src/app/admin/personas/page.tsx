import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, personaVersions } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { getProviderRegistry, resolveProviderId } from '@/lib/ai/registry';
import { getAdminView } from '@/lib/admin/view-preference-server';
import { formatCredits, initialsOf } from '@/lib/utils';
import { PersonasList, type PersonaRow } from './personas-list';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Personas' };

export default async function AdminPersonasPage() {
  const [rows, registry, view] = await Promise.all([
    db
      .select({
        persona: personas,
        modelTier: personaVersions.modelTier,
        model: personaVersions.model,
        aiProvider: personaVersions.aiProvider,
      })
      .from(personas)
      .leftJoin(personaVersions, eq(personaVersions.id, personas.currentVersionId))
      .orderBy(asc(personas.position), asc(personas.name)),
    getProviderRegistry(),
    getAdminView('personas'),
  ]);

  // Mapped to plain data here so the list component stays a thin client
  // component — a Drizzle row is not serialisable across that boundary.
  const items: PersonaRow[] = rows.map(({ persona, modelTier, model, aiProvider }) => ({
    id: persona.id,
    name: persona.name,
    expertise: persona.expertise,
    accentColor: persona.accentColor,
    initials: initialsOf(persona.name),
    model: modelTier
      ? modelTier.charAt(0).toUpperCase() + modelTier.slice(1)
      : (model ?? registry[resolveProviderId(aiProvider)].defaultModel),
    messages: formatCredits(persona.messagesCount),
    isActive: persona.isActive,
    isFeatured: persona.isFeatured,
  }));

  return (
    <div>
      <PageHeader
        title="Personas"
        description="Every AI specialist available on the platform."
        actions={
          <Link
            href="/admin/personas/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" /> New persona
          </Link>
        }
      />

      <PersonasList rows={items} view={view} />
    </div>
  );
}
