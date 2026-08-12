import { SkeletonListPage } from '@/components/ui/skeleton';

/**
 * Shown while the route's server component fetches. Before this there was no
 * `loading.tsx` anywhere in the app, so navigating held the previous screen
 * frozen until the query returned — indistinguishable from a click that did
 * not register.
 */
export default function Loading() {
  return <SkeletonListPage columns={4} />;
}
