import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, sectors } from '@/db/schema';
import { SectorForm } from '@/components/admin/sector-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit sector' };

export default async function EditSectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sectorId = Number(id);
  if (!Number.isFinite(sectorId)) notFound();

  const [[sector], categoryRows] = await Promise.all([
    db.select().from(sectors).where(eq(sectors.id, sectorId)).limit(1),
    db.select().from(categories).orderBy(asc(categories.position)),
  ]);
  if (!sector) notFound();

  return <SectorForm sector={sector} categories={categoryRows} />;
}
