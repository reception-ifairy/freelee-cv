/**
 * Applies ./offering-copy.ts to the existing /homeschooling page (the seed
 * never overwrites a page that exists). Changes only the lines that depend on
 * tutors being live: the meta description, the first block's heading and body,
 * the closing call to action, and a "When can my child start lessons?" answer
 * at the top of the FAQ. Every block is validated as the builder would.
 *
 *   npx tsx scripts/update-homeschooling-copy.ts          # dry run: shows what would change
 *   npx tsx scripts/update-homeschooling-copy.ts --apply
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { validateBlockConfig } from '../src/lib/blocks/validate';
import { HOMESCHOOLING_COPY as C } from './offering-copy';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const apply = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

try {
  const [page] = await sql`select id, meta_description from pages where slug = 'homeschooling'`;
  if (!page) throw new Error('No /homeschooling page.');
  const sections = await sql`select id, type, config from page_sections where page_id = ${page.id} order by position`;
  const updates: { id: number; type: string; config: Record<string, unknown> }[] = [];
  const first = sections.find((s) => s.type === 'custom_content');
  if (first) updates.push({ id: first.id, type: 'custom_content', config: { ...first.config, heading: C.heading, body: C.body } });
  const cta = sections.find((s) => s.type === 'cta');
  if (cta) updates.push({ id: cta.id, type: 'cta', config: { ...cta.config, subtitle: C.ctaSubtitle } });
  const faq = sections.find((s) => s.type === 'faq');
  if (faq) {
    const items = (faq.config.items ?? []) as { question: string; answer: string }[];
    const rest = items.filter((i) => i.question !== C.whenFaq.question);
    updates.push({ id: faq.id, type: 'faq', config: { ...faq.config, items: [C.whenFaq, ...rest] } });
  }
  for (const u of updates) {
    const result = validateBlockConfig(u.type, u.config);
    if (!result.ok) throw new Error(`${u.type}: ${result.error}`);
    u.config = result.config as Record<string, unknown>;
    console.log(`section ${u.id} (${u.type}): ${apply ? 'updated' : 'would update'}`);
  }
  console.log(`meta description: ${page.meta_description === C.metaDescription ? 'already current' : apply ? 'updated' : 'would update'}`);
  if (apply) {
    await sql.begin(async (tx) => {
      await tx`update pages set meta_description = ${C.metaDescription}, updated_at = now() where id = ${page.id}`;
      for (const u of updates) await tx`update page_sections set config = ${tx.json(u.config as never)}, updated_at = now() where id = ${u.id}`;
    });
  } else {
    console.log('\nDry run — nothing written. Add --apply.');
  }
} finally {
  await sql.end();
}
