import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { renderSection } from '@/components/site/sections';

export const revalidate = 300;

export default async function HomePage() {
  const sections = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.page, 'home'))
    .orderBy(asc(pageSections.position));

  const visible = sections.filter((s) => s.isVisible);
  // Only the visible sections' own components run their DB queries — a real
  // perf win over the old fixed page, which unconditionally fetched all
  // seven every render regardless of what was actually shown.
  const rendered = await Promise.all(visible.map((section) => renderSection(section.type, section.config)));

  return <>{rendered}</>;
}
