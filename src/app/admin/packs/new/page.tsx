import type { Metadata } from 'next';
import { PackForm } from '@/components/admin/pack-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New credit pack' };

export default function NewPackPage() {
  return <PackForm />;
}
