import { redirect } from 'next/navigation';
import { BROWSER_PATH } from '@/lib/taxonomy/browser';

/**
 * The bots list is the taxonomy browser since freelee #90 (owner, 2026-11-16:
 * "the taxonomy view is the model for the whole admin"). One list of bots,
 * with its tree, its card and the card's actions, instead of two that drift.
 *
 * Old links keep their filters where the browser has the same one:
 * `q`, `status` (published → live, draft → draft), `audience`, `category` →
 * `cat`, `sort` (name / newest / popular). Featured, premium and provider have
 * no filter there; the card shows them.
 */
const STATUS: Record<string, string> = { published: 'live', draft: 'draft' };
const SORT: Record<string, string> = { name: 'name', newest: 'newest', popular: 'popular' };

export default async function PersonasRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : undefined);
  const next = new URLSearchParams();
  const category = one('category');
  if (category && /^\d+$/.test(category)) next.set('cat', category);
  const q = one('q');
  if (q) next.set('q', q);
  const status = STATUS[one('status') ?? ''];
  if (status) next.set('status', status);
  const audience = one('audience');
  if (audience && ['B2C', 'B2B', 'B2G'].includes(audience)) next.set('audience', audience);
  const sort = SORT[one('sort') ?? ''];
  if (sort) next.set('sort', sort);
  const query = next.toString();
  redirect(query ? `${BROWSER_PATH}?${query}` : BROWSER_PATH);
}
