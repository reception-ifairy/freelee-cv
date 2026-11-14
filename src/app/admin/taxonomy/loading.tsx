import { SkeletonHeader, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Covers the browser and everything under /admin/taxonomy (a workspace,
 * Drafts, Audiences), so it is a header and rows — the shape they share —
 * rather than the grid of cards the taxonomy used to be.
 */
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonTable rows={10} columns={4} />
    </div>
  );
}
