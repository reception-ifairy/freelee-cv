import type { Metadata } from 'next';
import { CategoryForm } from '@/components/admin/category-form';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New category' };

export default function NewCategoryPage() {
  return <CategoryForm />;
}
