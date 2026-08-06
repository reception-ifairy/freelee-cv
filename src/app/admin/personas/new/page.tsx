import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { getProviderRegistry } from '@/lib/ai/registry';
import { PersonaForm } from '@/components/admin/persona-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New persona' };

export default async function NewPersonaPage() {
  const [categoryRows, providers] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position)),
    getProviderRegistry(),
  ]);

  return <PersonaForm categories={categoryRows} selectedCategoryIds={[]} providers={providers} />;
}
