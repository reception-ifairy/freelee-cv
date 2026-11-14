import Link from 'next/link';
import { attentionFacts } from '@/lib/admin/attention-queries';
import { actCount, attentionItems } from '@/lib/admin/attention';

/**
 * The header's "N to act on": how many things someone is waiting on (an order,
 * a lead, a listing, a failing connection), on every admin page, linking to
 * the dashboard's list. The light facts only (~10 ms; no market computation).
 * Nothing renders when nothing is waiting, and a failure here never takes the
 * page down with it.
 */
export async function AttentionBadge() {
  let count = 0;
  try {
    count = actCount(attentionItems(await attentionFacts({ markets: null })));
  } catch {
    return null;
  }
  if (count === 0) return null;
  return (
    <Link
      href="/admin#attention"
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-rose-400" />
      {count} to act on
    </Link>
  );
}
