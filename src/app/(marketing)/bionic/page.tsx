import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas } from '@/db/schema';
import { BionicOrganism } from '@/components/site/bionic-organism';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The Bionic Bot Organism',
  description: 'How Freelee compiles trust, cognitive scaffolding and persona systems into every AI bot.',
};

export default async function BionicPage() {
  const [featured] = await db
    .select({ slug: personas.slug })
    .from(personas)
    .where(and(eq(personas.isActive, true), eq(personas.isFeatured, true)))
    .orderBy(personas.position)
    .limit(1);

  return <BionicOrganism featuredPersonaHref={featured ? `/personas/${featured.slug}` : '/personas'} />;
}
