import { notFound, redirect } from 'next/navigation';

/**
 * A category's workspace is a view of the taxonomy browser since 2026-11-16
 * (the categories are the pillars; the tree on the left stays in reach). Old
 * links and bookmarks land on the same tab there.
 */
const TABS: Record<string, string> = { overview: 'brief', audiences: 'audiences', ai: 'agent' };

export default async function CategoryWorkspaceRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id)) notFound();
  const next = tab ? TABS[tab] : undefined;
  redirect(`/admin/taxonomy?cat=${id}${next ? `&tab=${next}` : ''}`);
}
