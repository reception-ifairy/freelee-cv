import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { getProviderRegistry } from '@/lib/ai/registry';
import { groundingOptions } from '@/lib/knowledge/grounding';
import { sectorOptions } from '@/lib/taxonomy/queries';
import { PersonaForm } from '@/components/admin/persona-form';
import { getSettings } from '@/lib/settings';
import { CURRICULUM_SCOPE_CACHE_KEY, readScopeCache } from '@/lib/curriculum/stored';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New persona' };

export default async function NewPersonaPage() {
  const [categoryRows, providers, knowledgeSourceRows, sectorRows, settings] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position)),
    getProviderRegistry(),
    groundingOptions(),
    sectorOptions(),
    getSettings(),
  ]);

  return (
    <PersonaForm
      categories={categoryRows}
      selectedCategoryIds={[]}
      providers={providers}
      knowledgeSources={knowledgeSourceRows}
      sectors={sectorRows.map((s) => ({ id: s.id, name: s.name, categoryName: s.categoryName }))}
      curriculumCache={readScopeCache(settings.get(CURRICULUM_SCOPE_CACHE_KEY))}
    />
  );
}
