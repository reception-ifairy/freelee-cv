import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { getProviderRegistry } from '@/lib/ai/registry';
import { getActiveKnowledgeSources } from '@/lib/knowledge/registry';
import { PersonaForm } from '@/components/admin/persona-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New persona' };

export default async function NewPersonaPage() {
  const [categoryRows, providers, knowledgeSourceRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position)),
    getProviderRegistry(),
    getActiveKnowledgeSources(),
  ]);

  return (
    <PersonaForm
      categories={categoryRows}
      selectedCategoryIds={[]}
      providers={providers}
      knowledgeSources={knowledgeSourceRows.map((s) => ({ key: s.key, label: s.label }))}
    />
  );
}
