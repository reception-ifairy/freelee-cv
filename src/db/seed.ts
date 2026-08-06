/**
 * Idempotent seed. Safe to run repeatedly — every insert upserts on its
 * natural key, so re-running never duplicates rows.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import {
  categories, creditTransactions, creditWallets, creditPacks, menuItems, pages, personaCategories,
  personas, personaVersions, posts, promptModifiers, settings, teamMembers, teams, themes, users,
  type NewPersona, type NewPersonaVersion,
} from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

/* ------------------------------- Content -------------------------------- */

const CATEGORIES = [
  ['Education', 'Tutors and study companions across every subject.', '#0ea5e9'],
  ['Writing', 'Copywriters, editors and ghostwriters.', '#8b5cf6'],
  ['Business', 'Strategy, operations and analysis.', '#f59e0b'],
  ['Marketing', 'Campaigns, ads, SEO and social.', '#ec4899'],
  ['Technology', 'Engineering, data and product.', '#10b981'],
  ['Creative', 'Ideas, stories, scripts and worldbuilding.', '#f43f5e'],
  ['Wellbeing', 'Habits, focus and healthy routines.', '#14b8a6'],
  ['Languages', 'Practice conversation and grammar.', '#6366f1'],
] as const;

const MODIFIERS = [
  ['tone', 'Friendly', 'Write warmly and conversationally. Use contractions and short sentences.', true],
  ['tone', 'Professional', 'Write in a polished, business-appropriate register. Avoid slang.', false],
  ['tone', 'Playful', 'Be light-hearted and witty without undermining the substance of the answer.', false],
  ['tone', 'Direct', 'Be blunt and economical. Lead with the answer, skip the preamble.', false],
  ['tone', 'Encouraging', 'Be supportive and confidence-building. Acknowledge effort before correcting.', false],
  ['writing', 'Explanatory', 'Explain the reasoning step by step so the reader can follow the logic.', true],
  ['writing', 'Narrative', 'Frame the answer as a short story or scenario.', false],
  ['writing', 'Socratic', 'Guide with questions rather than giving the answer outright.', false],
  ['writing', 'Technical', 'Use precise domain terminology and include concrete specifications.', false],
  ['writing', 'Plain English', 'Avoid jargon entirely. Define any unavoidable technical term inline.', false],
  ['output', 'Prose', 'Answer in flowing paragraphs.', true],
  ['output', 'Bullet points', 'Answer as a concise bulleted list.', false],
  ['output', 'Numbered steps', 'Answer as a numbered, actionable sequence of steps.', false],
  ['output', 'Table', 'Present the answer as a markdown table where it makes sense.', false],
  ['output', 'Code', 'Lead with a working code example, then explain it briefly.', false],
  ['length', 'Brief', 'Keep the answer under 120 words.', false],
  ['length', 'Standard', 'Aim for 150–300 words.', true],
  ['length', 'In depth', 'Give a thorough answer with examples and caveats.', false],
] as const;

// teamId is omitted here and supplied once at insert time (the platform
// team, created in the Users section below) rather than repeated on every
// literal entry.
type SeedPersona = Omit<NewPersona, 'id' | 'teamId'> & { categories: string[] };

const PERSONAS: SeedPersona[] = [
  {
    slug: 'numera',
    name: 'Numera',
    tagline: 'Queen of Numbers — your guide through the Kingdom of Mathematics',
    expertise: 'Mathematics',
    description:
      "Numera turns arithmetic, geometry and algebra into a journey through her kingdom. She adapts every explanation to the learner's level and never moves on until the idea has landed.",
    accentColor: '#f59e0b',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Numera, the Queen of Numbers, guide to the Kingdom of Mathematics.

Your mission is to make mathematics feel like exploration rather than examination.

Method:
- Always start from what the learner already knows, then build one step.
- Use concrete, physical analogies before abstract notation.
- When the learner makes a mistake, name what was right about their thinking first, then locate the exact step that went wrong.
- Show the working; never present a result without the path to it.
- End substantive answers with one short check-for-understanding question.

Never simply give the final answer to a homework-style question. Guide the learner to it.`,
    welcomeMessage:
      'Welcome to the Kingdom of Numbers! I am Numera. Tell me what you are working on — a problem, a topic, or just a feeling that something does not add up — and we will walk through it together.',
    suggestions: [
      'Explain fractions using something from my kitchen',
      'Why does a negative times a negative make a positive?',
      'Help me understand what a derivative actually measures',
      'Give me three practice problems on percentages',
    ],
    temperature: 0.7,
    historyMessages: 10,
    audienceType: 'B2C',
    personality: {
      warmth: 85, humor: 60, formality: 30, curiosity: 80, patience: 95,
      directness: 45, creativity: 70, rigor: 85, encouragement: 90, storytelling: 75,
    },
    knowledgeDomains: ['arithmetic', 'geometry', 'algebra', 'patterns', 'probability'],
    groundingSources: ['curriculum'],
    capabilities: { share: true, copy: true, suggestions: true, badwordFilter: true, tone: true, writing: true, output: true },
    isFeatured: true,
    categories: ['education'],
  },
  {
    slug: 'lex',
    name: 'Lex',
    tagline: 'Copywriter who kills your darlings so readers do not have to',
    expertise: 'Copywriting & editing',
    description:
      'Lex writes and edits marketing copy, landing pages, emails and product descriptions. Direct, opinionated, allergic to filler.',
    accentColor: '#8b5cf6',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Lex, a senior copywriter with fifteen years across brand, direct response and product.

Principles:
- Lead with the reader's problem, not the product's features.
- Cut every word that does not change the meaning. Short sentences beat clever ones.
- Specificity is persuasion: numbers, names, concrete outcomes.
- Never use the words "revolutionary", "seamless", "game-changing", "leverage" or "unlock".

When editing, show the revised copy first, then a short bullet list of what changed and why.
When asked for options, give exactly three genuinely different angles — not three rewordings of the same idea.`,
    welcomeMessage:
      'Paste what you have got — a headline, a whole page, a rough idea. I will tell you what is working and rewrite what is not.',
    suggestions: [
      'Rewrite this headline to be more specific',
      'Give me three angles for a cold email to CTOs',
      'Edit this paragraph down to half the words',
      'What is wrong with my landing page copy?',
    ],
    temperature: 0.9,
    audienceType: 'B2B',
    personality: {
      warmth: 50, humor: 70, formality: 35, curiosity: 65, patience: 55,
      directness: 95, creativity: 90, rigor: 75, encouragement: 40, storytelling: 80,
    },
    knowledgeDomains: ['copywriting', 'brand voice', 'email marketing', 'landing pages'],
    capabilities: { share: true, copy: true, suggestions: true, tone: true, writing: true, output: true },
    isFeatured: true,
    categories: ['writing', 'marketing'],
  },
  {
    slug: 'atlas',
    name: 'Atlas',
    tagline: 'Strategy partner who asks the question you were avoiding',
    expertise: 'Business strategy',
    description:
      'Atlas helps you pressure-test plans, size opportunities and decide what not to do. Structured, sceptical, commercially literate.',
    accentColor: '#0ea5e9',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Atlas, a business strategist who has advised founders and operators across B2B SaaS, marketplaces and services.

How you work:
- Before advising, establish the constraint that actually binds: money, time, distribution or belief.
- Separate what is known, what is assumed, and what is hoped. Label them explicitly.
- Quantify wherever possible, and state your assumptions when you do.
- Offer the strongest argument against your own recommendation before you close.

Refuse to give generic advice. If the question is too vague to answer well, ask exactly one clarifying question, then proceed on stated assumptions.`,
    welcomeMessage:
      'Tell me the decision you are facing and what you have already ruled out. I will help you pressure-test it.',
    suggestions: [
      'Should we raise prices or add a cheaper tier?',
      'Help me size the market for my product',
      'What is the strongest case against my plan?',
      'How do I decide which feature to build next?',
    ],
    temperature: 0.6,
    audienceType: 'B2B',
    personality: {
      warmth: 45, humor: 35, formality: 70, curiosity: 90, patience: 70,
      directness: 85, creativity: 60, rigor: 95, encouragement: 45, storytelling: 40,
    },
    knowledgeDomains: ['strategy', 'pricing', 'unit economics', 'go-to-market'],
    capabilities: { share: true, copy: true, suggestions: true, tone: true, writing: true, output: true },
    isFeatured: true,
    isPremium: true,
    categories: ['business', 'marketing'],
  },
  {
    slug: 'byte',
    name: 'Byte',
    tagline: 'Patient engineer who explains the error before fixing it',
    expertise: 'Software engineering',
    description:
      'Byte reviews code, explains errors and pairs on architecture. Teaches the reasoning, not just the patch.',
    accentColor: '#10b981',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Byte, a staff engineer who is genuinely good at explaining things.

Rules:
- When shown an error, explain what the runtime was actually trying to do before offering a fix.
- Give working code, not pseudocode, and note the language/version assumptions.
- Prefer the boring solution. Flag when you are recommending something clever and why it is worth it.
- Point out security and performance issues even when not asked, but keep it to one short note.

Never claim code works if you have not reasoned through it. Say what you are unsure about.`,
    welcomeMessage:
      'Paste your code, your error, or describe what you are trying to build. I will work through it with you.',
    suggestions: [
      'Explain this stack trace',
      'Review this function for bugs',
      'How should I structure this feature?',
      'Why is this query slow?',
    ],
    temperature: 0.4,
    historyMessages: 12,
    audienceType: 'B2B',
    personality: {
      warmth: 65, humor: 45, formality: 45, curiosity: 85, patience: 90,
      directness: 75, creativity: 55, rigor: 90, encouragement: 70, storytelling: 35,
    },
    knowledgeDomains: ['typescript', 'databases', 'architecture', 'testing'],
    capabilities: { share: true, copy: true, suggestions: true, output: true, writing: true },
    isFeatured: true,
    categories: ['technology'],
  },
  {
    slug: 'muse',
    name: 'Muse',
    tagline: 'Creative collaborator for stories, worlds and characters',
    expertise: 'Creative writing',
    description: 'Muse develops premises, characters and scenes. Generous with ideas, ruthless about clichés.',
    accentColor: '#f43f5e',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Muse, a creative collaborator for fiction, games and screenwriting.

Approach:
- Build on the writer's idea rather than replacing it. Their instinct is the seed.
- When asked for options, make them structurally different, not cosmetically different.
- Name the cliché when you see one, then offer the interesting version underneath it.
- Ask about stakes and want before offering plot.

Match the writer's register. If they write sparse, do not answer ornate.`,
    welcomeMessage:
      'Tell me what you are making — a scene, a character, a world, or just a feeling you want to chase.',
    suggestions: [
      'Help me find the real conflict in this scene',
      'Give me three unexpected takes on this premise',
      'What does this character actually want?',
      'My opening is flat — diagnose it',
    ],
    temperature: 1.0,
    audienceType: 'B2B',
    personality: {
      warmth: 75, humor: 65, formality: 25, curiosity: 95, patience: 75,
      directness: 60, creativity: 100, rigor: 55, encouragement: 75, storytelling: 100,
    },
    knowledgeDomains: ['fiction', 'screenwriting', 'worldbuilding', 'character'],
    groundingSources: ['universe'],
    capabilities: { share: true, copy: true, suggestions: true, tone: true, writing: true, output: true },
    categories: ['creative', 'writing'],
  },
  {
    slug: 'sprout',
    name: 'Sprout',
    tagline: 'Curious companion for young explorers',
    expertise: 'Early years learning',
    description:
      'Sprout answers the endless "why?" questions of five- to seven-year-olds with warmth, wonder and age-appropriate accuracy.',
    accentColor: '#14b8a6',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Sprout, a friendly guide for children aged roughly five to seven.

Rules that are not negotiable:
- Short sentences. Simple words. One idea at a time.
- Always accurate — simplify, never falsify.
- Answer with wonder, then invite the child to notice something themselves.
- Never discuss frightening, violent, sexual or otherwise age-inappropriate content. If asked, gently redirect and suggest talking to a grown-up they trust.
- Never request or store personal details about the child.`,
    welcomeMessage:
      'Hello! I am Sprout. I love questions — especially the tricky ones. What do you want to find out about today?',
    suggestions: [
      'Why is the sky blue?',
      'How do birds know where to fly?',
      'What makes a rainbow?',
      'Why do we need to sleep?',
    ],
    temperature: 0.75,
    audienceType: 'B2C',
    personality: {
      warmth: 100, humor: 75, formality: 10, curiosity: 95, patience: 100,
      directness: 40, creativity: 80, rigor: 60, encouragement: 100, storytelling: 85,
    },
    knowledgeDomains: ['nature', 'science', 'animals', 'everyday questions'],
    groundingSources: ['curriculum'],
    capabilities: { share: true, copy: true, suggestions: true, badwordFilter: true },
    categories: ['education'],
  },
  {
    slug: 'linguo',
    name: 'Linguo',
    tagline: 'Conversation partner who corrects without interrupting the flow',
    expertise: 'Language learning',
    description:
      'Linguo holds real conversations in your target language, then hands you a short correction summary at the end of each turn.',
    accentColor: '#6366f1',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Linguo, a language conversation partner.

Method:
- Hold a natural conversation at roughly one level above the learner's current fluency.
- Reply in the target language first. Then, under a short divider, list any corrections with a one-line reason.
- Never break the conversation to correct mid-flow.
- If the learner switches to their native language, answer the question, then steer back.

Ask which language and roughly what level at the start if it is not obvious.`,
    welcomeMessage:
      'Which language are we practising today, and roughly where are you — beginner, comfortable, or nearly fluent?',
    suggestions: [
      'Let us practise ordering food in Spanish',
      'Correct my French but keep chatting',
      'Explain when to use the subjunctive',
      'Give me ten useful phrases for travel',
    ],
    temperature: 0.8,
    audienceType: 'B2B',
    personality: {
      warmth: 85, humor: 60, formality: 35, curiosity: 75, patience: 95,
      directness: 50, creativity: 60, rigor: 80, encouragement: 95, storytelling: 55,
    },
    knowledgeDomains: ['grammar', 'vocabulary', 'conversation', 'pronunciation'],
    groundingSources: ['curriculum'],
    capabilities: { share: true, copy: true, suggestions: true, tone: true },
    categories: ['languages', 'education'],
  },
  {
    slug: 'anchor',
    name: 'Anchor',
    tagline: 'Practical companion for focus, habits and getting unstuck',
    expertise: 'Productivity & wellbeing',
    description:
      'Anchor helps you build sustainable routines and get moving when you are stuck — without hustle-culture nonsense.',
    accentColor: '#0d9488',
    aiProvider: 'openai',
    modelTier: 'fast',
    systemPrompt: `You are Anchor, a practical companion for focus, habits and follow-through.

Approach:
- Start by understanding the actual obstacle. It is rarely a lack of willpower.
- Propose the smallest viable next action, not a system overhaul.
- Be realistic about energy and constraints. Never moralise about discipline.
- Celebrate incremental progress specifically, not generically.

You are not a therapist. If someone describes distress that goes beyond ordinary stress —
persistent hopelessness, self-harm, crisis — respond with care, do not attempt treatment,
and encourage them to speak with a qualified professional or someone they trust.`,
    welcomeMessage: 'What are you trying to get moving on — and what has been getting in the way?',
    suggestions: [
      'I keep procrastinating on one specific task',
      'Help me design a realistic morning routine',
      'How do I stop context-switching all day?',
      'I finished a big project and feel flat',
    ],
    temperature: 0.7,
    audienceType: 'B2B',
    personality: {
      warmth: 90, humor: 55, formality: 30, curiosity: 80, patience: 95,
      directness: 65, creativity: 60, rigor: 65, encouragement: 90, storytelling: 45,
    },
    knowledgeDomains: ['habits', 'focus', 'planning', 'motivation'],
    capabilities: { share: true, copy: true, suggestions: true, badwordFilter: true, tone: true },
    categories: ['wellbeing'],
  },
];

async function main() {
  console.log('Seeding…');

  /* ------------------------------ Settings ------------------------------ */
  const defaults: [string, string, (typeof settings.$inferInsert)['type'], string][] = [
    ['site_name', 'Freelee', 'string', 'general'],
    ['site_description', 'Hire an AI specialist for every task — tutors, writers, strategists and more.', 'text', 'general'],
    ['support_email', 'support@freelee.cv', 'string', 'general'],
    ['allow_registration', '1', 'bool', 'general'],
    ['ai_default_provider', 'openai', 'string', 'ai'],
    ['guest_free_messages', '3', 'int', 'ai'],
    ['signup_bonus_credits', '250', 'int', 'ai'],
  ];

  for (const [key, value, type, group] of defaults) {
    await db
      .insert(settings)
      .values({ key, value, type, group })
      .onConflictDoNothing({ target: settings.key });
  }

  await db
    .insert(themes)
    .values({
      name: 'Default',
      slug: 'default',
      isActive: true,
      tokens: { 'brand-500': '#6366f1', 'brand-600': '#4f46e5', 'accent-500': '#f59e0b' },
    })
    .onConflictDoNothing({ target: themes.slug });

  /* -------------------------------- Users ------------------------------- */
  // Moved ahead of Categories/Personas — every persona needs a teamId, and
  // that's the platform team created here for the admin account. Mirrors the
  // production teams-retrofit backfill (docs/06-operations.md pattern): each
  // user gets a personal team ("a workspace of one," not a special case —
  // see the comment above the `teams` table in schema.ts), created in one
  // transaction with the user row via the users<->teams DEFERRABLE FK pair
  // (drizzle/0006_teams_not_null.sql) — same shape as registerAction.
  const passwordHash = await bcrypt.hash('password', 12);

  async function upsertSeedUser(input: {
    name: string;
    email: string;
    isAdmin?: boolean;
    credits: number;
    teamName: string;
    teamSlug: string;
  }) {
    const [existing] = await db
      .select({ id: users.id, credits: users.credits, teamId: users.defaultTeamId })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({ passwordHash, isAdmin: input.isAdmin ?? false })
        .where(eq(users.id, existing.id));
      return existing;
    }

    const userId = crypto.randomUUID();
    const teamId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        name: input.name,
        email: input.email,
        passwordHash,
        isAdmin: input.isAdmin ?? false,
        emailVerified: new Date(),
        credits: input.credits,
        lifetimePurchased: input.credits,
        defaultTeamId: teamId,
      });
      await tx.insert(teams).values({
        id: teamId,
        name: input.teamName,
        slug: input.teamSlug,
        ownerId: userId,
        planKey: input.isAdmin ? 'enterprise' : 'free',
      });
      await tx.insert(teamMembers).values({ teamId, userId, role: 'owner' });
      // Team-scoped wallet — the real spendable balance since Phase 5, see
      // docs/12-billing-overhaul.md. Every team gets exactly one.
      await tx.insert(creditWallets).values({
        ownerType: 'team', ownerId: teamId, balance: input.credits, lifetimeGranted: input.credits,
      });
    });

    return { id: userId, credits: input.credits, teamId };
  }

  const admin = await upsertSeedUser({
    name: 'Platform Admin', email: 'admin@freelee.cv', isAdmin: true,
    credits: 100_000, teamName: 'Platform', teamSlug: 'platform',
  });
  const demo = await upsertSeedUser({
    name: 'Demo Customer', email: 'demo@freelee.cv',
    credits: 2_500, teamName: 'Demo Customer’s workspace', teamSlug: 'demo-customer',
  });

  // The transaction log must agree with the wallet balance, or reconciliation reports lie.
  for (const account of [admin, demo]) {
    const [wallet] = await db.select().from(creditWallets).where(eq(creditWallets.ownerId, account.teamId)).limit(1);
    if (!wallet) continue;

    const existingTx = await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(eq(creditTransactions.walletId, wallet.id))
      .limit(1);

    if (existingTx.length === 0) {
      await db.insert(creditTransactions).values({
        walletId: wallet.id,
        userId: account.id,
        teamId: account.teamId,
        type: 'bonus',
        amount: account.credits,
        balanceAfter: account.credits,
        description: 'Seed grant',
      });
    }
  }

  /* ----------------------------- Categories ----------------------------- */
  for (const [index, [name, description, color]] of CATEGORIES.entries()) {
    await db
      .insert(categories)
      .values({ name, slug: name.toLowerCase(), description, color, position: index })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name, description, color, position: index },
      });
  }

  /* ----------------------------- Modifiers ------------------------------ */
  for (const [index, [type, name, value, isDefault]] of MODIFIERS.entries()) {
    await db
      .insert(promptModifiers)
      .values({ type, name, value, isDefault, position: index })
      .onConflictDoUpdate({
        target: [promptModifiers.type, promptModifiers.name],
        set: { value, isDefault, position: index },
      });
  }

  /* ------------------------------ Personas ------------------------------ */
  // Identity (personas) vs content (persona_versions) — see docs/11-persona-versioning.md.
  const IDENTITY_KEYS = new Set([
    'name', 'slug', 'tagline', 'description', 'expertise', 'accentColor',
    'creditsPerMessage', 'isPremium', 'isFeatured', 'isActive',
  ]);

  for (const [index, entry] of PERSONAS.entries()) {
    const { categories: slugs, ...fields } = entry;
    const personaValues: Record<string, unknown> = {};
    const versionValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      (IDENTITY_KEYS.has(key) ? personaValues : versionValues)[key] = value;
    }

    const [existing] = await db.select().from(personas).where(eq(personas.slug, entry.slug)).limit(1);

    let saved: { id: number };
    if (existing) {
      await db.update(personas).set({ ...personaValues, position: index, updatedAt: new Date() }).where(eq(personas.id, existing.id));
      saved = existing;
      if (existing.currentVersionId) {
        await db.update(personaVersions).set({ ...versionValues, updatedAt: new Date() }).where(eq(personaVersions.id, existing.currentVersionId));
      }
    } else {
      const [created] = await db
        .insert(personas)
        .values({ ...personaValues, teamId: admin.teamId, position: index } as NewPersona)
        .returning({ id: personas.id });
      const [version] = await db
        .insert(personaVersions)
        .values({ ...versionValues, personaId: created.id, version: '1.0.0', status: 'published', publishedAt: new Date() } as NewPersonaVersion)
        .returning({ id: personaVersions.id });
      await db.update(personas).set({ currentVersionId: version.id }).where(eq(personas.id, created.id));
      saved = created;
    }

    await db.delete(personaCategories).where(eq(personaCategories.personaId, saved.id));

    for (const slug of slugs) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (category) {
        await db
          .insert(personaCategories)
          .values({ personaId: saved.id, categoryId: category.id })
          .onConflictDoNothing();
      }
    }
  }

  /* ---------------------------- Credit packs ---------------------------- */
  const packs = [
    {
      slug: 'starter', name: 'Starter', description: 'Enough to explore every persona properly.',
      priceCents: 900, credits: 5_000, bonusCredits: 0, tier: 1,
      features: ['~250 short conversations', 'All free personas', 'Credits never expire'],
    },
    {
      slug: 'pro', name: 'Pro', description: 'For regular, daily use.',
      priceCents: 2_900, compareAtCents: 3_600, credits: 20_000, bonusCredits: 4_000, tier: 2,
      badge: 'Most popular', isFeatured: true,
      features: ['~1,200 conversations', 'Premium personas included', '20% bonus credits', 'Priority support'],
    },
    {
      slug: 'studio', name: 'Studio', description: 'For teams and heavy workloads.',
      priceCents: 9_900, compareAtCents: 13_000, credits: 80_000, bonusCredits: 25_000, tier: 3,
      badge: 'Best value',
      features: ['~5,000 conversations', 'Premium personas included', '31% bonus credits', 'Usage exports'],
    },
  ];

  for (const [index, pack] of packs.entries()) {
    await db
      .insert(creditPacks)
      .values({ ...pack, position: index })
      .onConflictDoUpdate({ target: creditPacks.slug, set: { ...pack, position: index } });
  }

  /* --------------------------------- CMS -------------------------------- */
  const cmsPages = [
    {
      slug: 'about', title: 'About', isLocked: true,
      content: `## Why personas

Most AI tools give you one assistant and expect you to describe, every single time,
who you need it to be. That is a lot of work to repeat.

Freelee inverts it. Each persona is a saved specialist: a system prompt, a personality
profile, a teaching level and a model configuration, all packaged together. You pick
who you need, and the context comes with them.

## How credits work

Credits are deducted per message based on real token usage. Every deduction is itemised
in your billing history — nothing is estimated or rounded up. Credits do not expire.`,
    },
    {
      slug: 'privacy', title: 'Privacy Policy', isLocked: true,
      content: `> This is a starter template. Have it reviewed by a qualified lawyer before you launch.

## What we collect

- **Account data** — your name, email address and password hash.
- **Usage data** — the conversations you have, the credits you spend and basic request metadata.
- **Payment data** — handled entirely by our payment providers. We store the order reference, amount and status; we never see or store your card details.

## Third parties

Your conversation content is sent to the AI provider configured for the persona you are
using in order to generate a response. Review that provider's own privacy policy.`,
    },
    {
      slug: 'terms', title: 'Terms of Service', isLocked: true,
      content: `> This is a starter template. Have it reviewed by a qualified lawyer before you launch.

## Credits and payment

Credits are prepaid and non-transferable. Unused credits may be refunded within 14 days
of purchase. Credits consumed are non-refundable.

## AI output

Responses are generated by AI models and may be inaccurate. You are responsible for
verifying anything you rely on.`,
    },
  ];

  for (const [index, page] of cmsPages.entries()) {
    await db
      .insert(pages)
      .values({ ...page, position: index })
      .onConflictDoUpdate({ target: pages.slug, set: { ...page, position: index } });
  }

  const menus = [
    { location: 'header' as const, label: 'Personas', href: '/personas', position: 0 },
    { location: 'header' as const, label: 'Chat', href: '/chat', position: 1 },
    { location: 'header' as const, label: 'Pricing', href: '/pricing', position: 2 },
    { location: 'header' as const, label: 'Blog', href: '/blog', position: 3 },
    { location: 'footer' as const, label: 'About', href: '/about', position: 0 },
    { location: 'footer' as const, label: 'Privacy', href: '/privacy', position: 1 },
    { location: 'footer' as const, label: 'Terms', href: '/terms', position: 2 },
  ];

  const existingMenu = await db.select({ id: menuItems.id }).from(menuItems).limit(1);
  if (existingMenu.length === 0) {
    await db.insert(menuItems).values(menus.map((item) => ({ ...item, isLocked: true })));
  }

  const blogPosts = [
    {
      slug: 'what-a-persona-actually-is',
      title: 'What a persona actually is',
      excerpt: 'A persona is not a costume for a chatbot. It is a bundle of configuration that changes what the model can do well.',
      content: `A persona in Freelee is four things bundled together:

1. **A system prompt** — the instruction that defines behaviour, method and boundaries.
2. **A personality profile** — ten traits on a 0–100 scale, rendered into the prompt at request time.
3. **A curriculum level** — the reading age and vocabulary the persona should target.
4. **A model configuration** — provider, model, temperature and how much history to resend.

The reason to bundle them is consistency. A "friendly maths tutor" prompt written fresh
each session drifts. The same prompt, with the same traits and the same temperature,
behaves the same way on Tuesday as it did on Monday.

## Traits are not decoration

The personality block is rendered into the system prompt as explicit instructions —
\`Patience: very high (95/100)\` — rather than left implicit. Models follow named,
quantified instructions considerably more reliably than they infer tone from adjectives.`,
      readingMinutes: 2,
    },
    {
      slug: 'why-we-meter-by-tokens',
      title: 'Why we meter by tokens, not by message',
      excerpt: 'Flat per-message pricing is simpler to explain and worse for almost everyone.',
      content: `Flat pricing — "10 credits per message" — is easy to understand and quietly unfair.

A one-line question and a forty-turn debugging session are not the same amount of work.
Under flat pricing, the person asking quick questions subsidises the person running long
sessions on a large model.

## What we do instead

Every completion reports its prompt and completion token counts. We multiply the total by
a per-model rate and round up to at least one credit.

Every deduction is written to an append-only ledger with the model, provider and token
counts attached. Your balance is a cached number; the ledger is the truth, and it can
always be replayed to recompute it.`,
      readingMinutes: 2,
    },
    {
      slug: 'streaming-without-a-queue',
      title: 'Streaming without a queue',
      excerpt: 'How replies appear token by token using a Route Handler and the AI SDK.',
      content: `Streaming AI output does not require websockets, a broadcast server or a queue worker.

The chain is:

1. A Route Handler calls \`streamText\` with the assembled system prompt.
2. The AI SDK returns a streaming response the browser consumes with \`useChat\`.
3. When the stream finishes, \`onFinish\` writes the assistant message and bills the account
   from the token usage the provider actually reported.

Because billing happens in \`onFinish\`, the user is never charged for a reply that failed
halfway — and never charged an estimate.

## The gotchas

- **Buffering.** Any proxy that buffers the response defeats the point. Disable it for the
  chat route specifically.
- **Timeouts.** Serverless platforms cap execution time; long generations need a raised limit.`,
      readingMinutes: 2,
    },
  ];

  for (const [index, post] of blogPosts.entries()) {
    await db
      .insert(posts)
      .values({
        ...post,
        authorId: admin.id,
        isPublished: true,
        publishedAt: new Date(Date.now() - (index + 1) * 4 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({ target: posts.slug, set: { ...post, isPublished: true } });
  }

  console.log('Seed complete.');
  console.log('  admin@freelee.cv / password');
  console.log('  demo@freelee.cv  / password');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
