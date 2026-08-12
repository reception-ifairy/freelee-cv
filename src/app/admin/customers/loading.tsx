import { SkeletonListPage } from '@/components/ui/skeleton';

/** This list defaults to the table view, so the fallback mirrors a table. */
export default function Loading() {
  return <SkeletonListPage view="table" />;
}
