import { Skeleton, SkeletonHeader, SkeletonStats } from '@/components/ui/skeleton';

/**
 * The dashboard runs six aggregate queries, so it is the slowest screen in the
 * panel and the one most in need of a fallback.
 */
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonStats />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}
