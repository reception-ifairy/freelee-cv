/**
 * Creates the two offering pages — For business and Homeschooling — as
 * ordinary CMS pages built from blocks, and links them in the header and the
 * footer (update #72).
 *
 *   npx tsx scripts/seed-offering-pages.ts            # dry run: validates every block, writes nothing
 *   npx tsx scripts/seed-offering-pages.ts --apply
 *
 * Why a script and not code pages: the owner edits these pages afterwards in
 * the on-page builder like any other CMS page; the script is only the first
 * version, validated through the same `validateBlockConfig` the builder uses.
 * It never overwrites: a page whose slug exists is left alone (its blocks may
 * already have been edited), and a menu link that already points there is not
 * added twice.
 *
 * Every claim below is a feature that exists on freelee today (2026-11-13);
 * the lesson cost range is the measured one from docs/53. The homeschooling
 * lines that depend on tutors being live are in ./offering-copy.ts (softened
 * on 2026-11-14 while no tutor is active; scripts/update-homeschooling-copy.ts
 * applies them to the existing page).
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { validateBlockConfig } from '../src/lib/blocks/validate';
import { DEFAULT_BLOCK_LAYOUT } from '../src/lib/blocks/layout';
import { HOMESCHOOLING_COPY } from './offering-copy';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type Block = { type: string; config: Record<string, unknown>; layout?: Record<string, unknown> };
type PageSeed = { slug: string; title: string; metaTitle: string; metaDescription: string; menuLabel: string; blocks: Block[] };

const HOMESCHOOLING: PageSeed = {
  slug: 'homeschooling',
  title: 'Homeschooling with AI tutors',
  metaTitle: 'Homeschooling with AI tutors — one plan for your child, built on the UK curriculum',
  metaDescription:
    HOMESCHOOLING_COPY.metaDescription,
  menuLabel: 'Homeschooling',
  blocks: [
    {
      type: 'custom_content',
      config: {
        heading: HOMESCHOOLING_COPY.heading,
        body: HOMESCHOOLING_COPY.body,
        ctaLabel: 'Create a parent account',
        ctaHref: '/register',
      },
    },
    {
      type: 'how_it_works',
      config: {
        title: 'How it works',
        subtitle: 'From sign-up to the first lesson in a few minutes.',
        steps: [
          { icon: 'users', title: 'Create your parent account', body: 'Accounts are for adults. Confirm you are 18 or over and confirm your email.' },
          { icon: 'heart', title: 'Add your child', body: 'A nickname, their school year and the subjects you want. Nothing more is needed — and every field says why we ask.' },
          { icon: 'sparkles', title: 'We build their plan', body: 'The topics for their year, in order, from the curriculum. Only the year and subjects are used — never anything about your child.' },
          { icon: 'rocket', title: 'Hand over the device', body: 'Child mode shows only their tutors and lessons. Leaving it needs your password.' },
        ],
      },
    },
    {
      type: 'features_grid',
      config: {
        title: 'Built for children, run by parents',
        items: [
          { icon: 'check', title: 'From the curriculum', body: 'Topics and official learning objectives for Key Stages 1–4, with GCSE settings from Year 9 (tier, combined or triple science).' },
          { icon: 'clock', title: 'Remembers what they learned', body: 'Progress is saved in the plan, and topics they have mastered come back for short reviews after 1, 3, 7 and 21 days.' },
          { icon: 'heart', title: 'Kind by design', body: 'Tutors never call an answer wrong or a task easy, and never compare your child with others. They give a hint and let them try again.' },
          { icon: 'users', title: 'Read every lesson', body: 'You can open any lesson in full. Your child sees a note that their grown-up can read the chats.' },
          { icon: 'lock', title: 'Encrypted on our own server', body: 'Profiles, plans and lessons are encrypted with a key for each child. We never ask for a real name, date of birth, school or photos.' },
          { icon: 'shield', title: 'Adapted to your child', body: 'Shorter sentences, more breaks, no timed challenges, one instruction at a time — tick what helps.' },
        ],
      },
    },
    {
      type: 'faq',
      config: {
        title: 'Questions parents ask',
        items: [
          HOMESCHOOLING_COPY.whenFaq,
          { question: 'Which curriculum do the tutors follow?', answer: 'The national curriculum for England: the official learning objectives for each year, organised into topics in order, and GCSE subject content from Year 9. Topic lists are reviewed by our team; the official objectives are always the authority.' },
          { question: 'Which years are covered?', answer: 'Year 1 to Year 11. Years 1–6 and 9–11 have full topic lists. Years 7 and 8 currently follow the official Key Stage 3 objectives directly; their topic lists are coming.' },
          { question: 'What do you store about my child?', answer: 'Only what you choose: a nickname, school year, subjects and, if you like, interests and practical adaptations. It is encrypted with your child’s own key. Lessons are deleted 90 days after the last message, and profiles nobody uses for 12 months are deleted too — we email you first.' },
          { question: 'Can I read what my child and the tutor talk about?', answer: 'Yes, every lesson, in full, from your Children page. You can also download everything we hold about your child as one file.' },
          { question: 'Does it replace a teacher?', answer: 'No. Tutors are AI: patient and available any time, but they can make mistakes. Use them to practise and explore, and check anything important.' },
          { question: 'How much does it cost?', answer: 'You pay per message with credits — no subscription. New accounts start with free credits. In our measurements a lesson reply cost about 40–80 credits; see [Pricing](/pricing) for credit packs.' },
        ],
      },
    },
    {
      type: 'cta',
      config: {
        title: 'Start learning at home today',
        subtitle: HOMESCHOOLING_COPY.ctaSubtitle,
        buttonLabel: 'Create a parent account',
      },
    },
  ],
};

const BUSINESS: PageSeed = {
  slug: 'business',
  title: 'AI specialists for your business',
  metaTitle: 'AI specialists for your business — Freelee',
  metaDescription:
    'Specialist AI personas for sales, marketing, finance, legal, design and more. Shape how they answer, work on them as a team, sell your own on the marketplace and pay per message.',
  menuLabel: 'For business',
  blocks: [
    {
      type: 'custom_content',
      config: {
        heading: 'Specialists for the work your business actually does',
        body: [
          'Freelee personas are AI specialists, each built for one field — sales strategy, social media and email marketing, financial consulting, compliance, legal information, web design and development, copywriting, data science and many more.',
          '',
          '- **Ready to work.** Pick a specialist and start a conversation — no setup, no prompt engineering.',
          '- **Grounded where it matters.** Our business advisers read from a curated library — strategy frameworks, a business-plan method and research on AI adoption — and cite what they use.',
          '- **Pay as you go.** Credits per message, no subscription.',
        ].join('\n'),
        ctaLabel: 'Browse the specialists',
        ctaHref: '/personas',
      },
    },
    {
      type: 'features_grid',
      config: {
        title: 'Everything a team needs',
        items: [
          { icon: 'users', title: 'Specialists by sector', body: 'Dozens of personas across more than thirty industries, from sales and marketing to finance, legal and engineering.' },
          { icon: 'sparkles', title: 'Answers your way', body: 'Choose the tone, writing style and output format, and how a persona handles a question it cannot answer for sure.' },
          { icon: 'shield', title: 'Team workspace', body: 'Invite colleagues into one workspace with roles, and share its credits and conversations.' },
          { icon: 'globe', title: 'On your website', body: 'On request, a persona can be switched on as a chat widget for your own site, so customers talk to it where they already are.' },
          { icon: 'chart', title: 'Sell your own bots', body: 'Build a persona once and offer it on the Freelee marketplace from your vendor dashboard.' },
          { icon: 'lock', title: 'Your data is yours', body: 'Export your team’s personas, conversations and usage as one file whenever you want.' },
        ],
      },
    },
    {
      type: 'how_it_works',
      config: {
        title: 'From first question to everyday tool',
        subtitle: 'No setup and no prompt engineering — start with one specialist and grow from there.',
        steps: [
          { icon: 'message-square', title: 'Pick a specialist', body: 'Browse by industry and start chatting. New accounts get free credits.' },
          { icon: 'sparkles', title: 'Shape the answers', body: 'Set the tone and format that fit your work.' },
          { icon: 'users', title: 'Bring your team', body: 'Invite colleagues into your workspace with the right roles.' },
          { icon: 'chart', title: 'Put it to work', body: 'Use it every day, ask us to put it on your site, or sell your own personas on the marketplace.' },
        ],
      },
    },
    {
      type: 'faq',
      config: {
        title: 'Questions businesses ask',
        items: [
          { question: 'How is it priced?', answer: 'Per message, with credits — no subscription and no seat licences. Credit packs are on the [Pricing](/pricing) page; new accounts start with free credits.' },
          { question: 'Can my whole team use it?', answer: 'Yes. Invite members to your workspace and give them roles; the workspace shares its credits.' },
          { question: 'Can I put a persona on my own website?', answer: 'Yes, on request: we switch the persona on as a chat widget and you add one line to your site. [Contact us](/about) to set it up.' },
          { question: 'Do the answers come from real sources?', answer: 'Our business advisers read from a curated library and cite what they use. Like any AI, personas can still make mistakes, so check anything important before you act on it.' },
          { question: 'Can I take my data with me?', answer: 'Yes. Your team’s personas, conversations and usage can be exported as one file at any time.' },
        ],
      },
    },
    {
      type: 'cta',
      config: {
        title: 'Put a specialist to work today',
        subtitle: 'Create an account — {credits} credits on us. No subscription.',
        buttonLabel: 'Create your account',
      },
    },
  ],
};

const apply = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

try {
  const seeds = [BUSINESS, HOMESCHOOLING];
  // Validate everything first — a dry run proves the blocks would save in the builder.
  const validated = seeds.map((seed) => ({
    seed,
    blocks: seed.blocks.map((block, i) => {
      const result = validateBlockConfig(block.type, block.config);
      if (!result.ok) throw new Error(`${seed.slug} block ${i + 1} (${block.type}): ${result.error}`);
      return { type: block.type, config: result.config, layout: { ...DEFAULT_BLOCK_LAYOUT, ...(block.layout ?? {}) } };
    }),
  }));
  for (const { seed, blocks } of validated) console.log(`${seed.slug}: ${blocks.length} blocks valid (${blocks.map((b) => b.type).join(', ')})`);

  if (!apply) {
    console.log('\nDry run — nothing written. Add --apply.');
  } else {
    await sql.begin(async (tx) => {
      for (const { seed, blocks } of validated) {
        const [existing] = await tx`select id from pages where slug = ${seed.slug}`;
        if (existing) {
          console.log(`${seed.slug}: page exists (id ${existing.id}) — left as it is.`);
        } else {
          const [{ max }] = await tx`select coalesce(max(position), 0) as max from pages`;
          const [page] = await tx`
            insert into pages (title, slug, content, meta_title, meta_description, is_published, use_builder, position)
            values (${seed.title}, ${seed.slug}, '', ${seed.metaTitle}, ${seed.metaDescription}, true, true, ${Number(max) + 1})
            returning id`;
          for (const [position, block] of blocks.entries()) {
            await tx`
              insert into page_sections (page, page_id, type, position, is_visible, config, layout)
              values ('page', ${page.id}, ${block.type}, ${position}, true, ${tx.json(block.config as never)}, ${tx.json(block.layout as never)})`;
          }
          console.log(`${seed.slug}: page ${page.id} created with ${blocks.length} blocks.`);
        }
      }

      // Header: right after Personas. Footer: before About. Existing links keep their order.
      for (const location of ['header', 'footer'] as const) {
        const items = await tx`select id, href, position from menu_items where location = ${location} and parent_id is null order by position, id`;
        const missing = validated.map(({ seed }) => seed).filter((seed) => !items.some((i) => i.href === `/${seed.slug}`));
        if (missing.length === 0) { console.log(`${location}: links already there.`); continue; }
        const insertAt = location === 'header' ? Math.max(1, items.findIndex((i) => i.href === '/personas') + 1) : 0;
        const ordered: ({ id: number } | { seed: PageSeed })[] = [
          ...items.slice(0, insertAt).map((i) => ({ id: i.id as number })),
          ...missing.map((seed) => ({ seed })),
          ...items.slice(insertAt).map((i) => ({ id: i.id as number })),
        ];
        for (const [position, entry] of ordered.entries()) {
          if ('id' in entry) await tx`update menu_items set position = ${position} where id = ${entry.id}`;
          else await tx`insert into menu_items (location, label, href, position, visible_to, is_active) values (${location}, ${entry.seed.menuLabel}, ${`/${entry.seed.slug}`}, ${position}, 'all', true)`;
        }
        console.log(`${location}: added ${missing.map((s) => s.menuLabel).join(', ')}.`);
      }
    });
  }
} finally {
  await sql.end();
}
