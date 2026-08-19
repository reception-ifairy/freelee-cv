import { redirect } from 'next/navigation';

/**
 * Merged into /admin/taxonomy.
 *
 * A sector only means something inside its category, and while `sectors` was
 * write-only a separate tab could only ever be filled in — never read. Same
 * redirect-rather-than-delete treatment /admin/ai-models got when it moved into
 * Settings, so existing links and bookmarks still land somewhere sensible.
 */
export default function Redirect() {
  redirect('/admin/taxonomy');
}
