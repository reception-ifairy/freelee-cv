import { redirect } from 'next/navigation';

/**
 * The six computed markets were retired on 2026-11-16 — the taxonomy's
 * categories are the pillars now. Homeschooling lives under Education and
 * Training (with its hub tabs), business under Business and Finance; the
 * other four markets have no successor, so they land on the taxonomy.
 */
const TO: Record<string, string> = {
  homeschooling: '/admin/taxonomy?cat=education-and-training',
  business: '/admin/taxonomy?cat=business-and-finance',
};
const HUB_TABS = new Set(['tutors', 'curriculum', 'families']);

export default async function MarketRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ pillar: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ pillar }, { tab }] = await Promise.all([params, searchParams]);
  const base = TO[pillar];
  if (!base) redirect('/admin/taxonomy');
  redirect(pillar === 'homeschooling' && tab && HUB_TABS.has(tab) ? `${base}&tab=${tab}` : base);
}
