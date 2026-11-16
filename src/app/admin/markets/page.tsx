import { redirect } from 'next/navigation';

/** The six computed markets were retired on 2026-11-16: the taxonomy's categories are the pillars. */
export default function MarketsRedirect() {
  redirect('/admin/taxonomy');
}
