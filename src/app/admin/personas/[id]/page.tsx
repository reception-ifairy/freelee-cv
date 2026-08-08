import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, personaCategories, personas, personaVersions } from '@/db/schema';
import { getProviderRegistry } from '@/lib/ai/registry';
import { getActiveKnowledgeSources } from '@/lib/knowledge/registry';
import { PersonaForm } from '@/components/admin/persona-form';
import { resolveLayoutForPersona } from '@/lib/chat/resolve-layout';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit persona' };

export default async function EditPersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personaId = Number(id);
  if (!Number.isFinite(personaId)) notFound();

  const [[persona], categoryRows, links, providers, knowledgeSourceRows] = await Promise.all([
    db.select().from(personas).where(eq(personas.id, personaId)).limit(1),
    db.select().from(categories).orderBy(asc(categories.position)),
    db
      .select({ categoryId: personaCategories.categoryId })
      .from(personaCategories)
      .where(eq(personaCategories.personaId, personaId)),
    getProviderRegistry(),
    getActiveKnowledgeSources(),
  ]);

  if (!persona) notFound();

  // Edit the draft if one's in progress (pinVersioning=true), otherwise the
  // current version. See docs/11-persona-versioning.md.
  const editingVersionId = persona.draftVersionId ?? persona.currentVersionId;
  const [[version], versionHistory] = await Promise.all([
    editingVersionId
      ? db.select().from(personaVersions).where(eq(personaVersions.id, editingVersionId)).limit(1)
      : Promise.resolve([undefined]),
    db
      .select()
      .from(personaVersions)
      .where(eq(personaVersions.personaId, personaId))
      .orderBy(desc(personaVersions.publishedAt)),
  ]);

  // Shown in the layout picker as "Suggested — currently: X", so the
  // auto-default is visible rather than implicit.
  const suggestedLayout = await resolveLayoutForPersona(
    personaId,
    null,
    version?.audienceType,
    version?.audienceSegments,
  );

  return (
    <PersonaForm
      suggestedLayout={suggestedLayout}
      persona={persona}
      version={version}
      versionHistory={versionHistory.filter((v) => v.status === 'published')}
      categories={categoryRows}
      selectedCategoryIds={links.map((link) => link.categoryId)}
      providers={providers}
      knowledgeSources={knowledgeSourceRows.map((s) => ({ key: s.key, label: s.label }))}
    />
  );
}
