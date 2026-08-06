import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { creditPacks } from '@/db/schema';
import { PackForm } from '@/components/admin/pack-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit credit pack' };

export default async function EditPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packId = Number(id);
  if (!Number.isFinite(packId)) notFound();

  const [pack] = await db.select().from(creditPacks).where(eq(creditPacks.id, packId)).limit(1);
  if (!pack) notFound();

  return <PackForm pack={pack} />;
}
