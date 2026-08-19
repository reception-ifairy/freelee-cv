/**
 * The handbook's table of contents.
 *
 * Explicit and ordered, not a directory scan — the reading order *is* the
 * teaching, and alphabetical filenames don't encode it. Same static-registry
 * reasoning as `src/lib/modules/registry.ts`.
 *
 * This is the **user handbook**: written for the person running the site, in
 * plain language, with examples. It is deliberately separate from `docs/`,
 * which is engineering documentation written for whoever maintains the code.
 * Two audiences, two voices, two places.
 */
export type HandbookPage = { slug: string; title: string; summary: string };
export type HandbookPart = { title: string; pages: HandbookPage[] };

export const HANDBOOK: HandbookPart[] = [
  {
    title: 'Start here',
    pages: [
      {
        slug: 'welcome',
        title: 'What this platform does',
        summary: 'The whole idea in one page, and the words you will see everywhere.',
      },
      {
        slug: 'one-bot-or-a-team',
        title: 'One assistant, or a team?',
        summary: 'The three ways of working — a single chat, a room, and a crew — and when each one is right.',
      },
      {
        slug: 'first-persona',
        title: 'Create your first persona',
        summary: 'A complete walkthrough, from empty catalogue to a working assistant.',
      },
    ],
  },
  {
    title: 'Personas',
    pages: [
      { slug: 'persona-basics', title: 'Basics tab', summary: 'Name, tagline, description, colour — everything visitors see first.' },
      { slug: 'persona-prompt', title: 'Prompt tab', summary: 'The instructions that make a persona who it is.' },
      { slug: 'persona-model', title: 'Model tab', summary: 'Which AI does the thinking, and how much freedom it gets.' },
      { slug: 'persona-personality', title: 'Personality tab', summary: 'Ten sliders that change how a persona comes across.' },
      { slug: 'persona-capabilities', title: 'Capabilities tab', summary: 'Buttons, voice, suggestions, and the chat layout.' },
      { slug: 'persona-publishing', title: 'Publishing tab', summary: 'Drafts, versions, and putting a persona live.' },
      { slug: 'persona-cards', title: 'How a persona looks', summary: 'The generated mark instead of a face, the flip card, categories and sectors, and dragging personas onto a team.' },
    ],
  },
  {
    title: 'Teamwork',
    pages: [
      {
        slug: 'projects',
        title: 'Projects',
        summary: 'Grouping the work for one job, and seeing what it cost.',
      },
      {
        slug: 'bot-teams',
        title: 'Bot teams',
        summary: 'Building a team of personas, running it, watching it work and stopping it.',
      },
    ],
  },
  {
    title: 'Content and appearance',
    pages: [
      { slug: 'frontpage', title: 'Front page', summary: 'Rearrange your home page without touching code.' },
      { slug: 'content', title: 'Blog, pages and menus', summary: 'Everything else visitors read.' },
      { slug: 'branding', title: 'Branding', summary: 'Colours, logo, favicon and fonts.' },
      { slug: 'translations', title: 'Translations', summary: 'Running the site in another language.' },
    ],
  },
  {
    title: 'Money',
    pages: [
      { slug: 'credits', title: 'How credits work', summary: 'What a message costs and why.' },
      { slug: 'selling', title: 'Packs, plans and passes', summary: 'The three ways to sell access, compared.' },
    ],
  },
  {
    title: 'Platform',
    pages: [
      { slug: 'ai-models', title: 'AI models', summary: 'Connecting providers and choosing which models you offer.' },
      { slug: 'knowledge-sources', title: 'Knowledge sources', summary: 'Letting a persona cite from your own documents.' },
      { slug: 'settings', title: 'Settings', summary: 'The options that apply to the whole site.' },
    ],
  },
  {
    title: 'Help',
    pages: [
      { slug: 'faq', title: 'FAQ', summary: 'Short answers to the questions that come up most.' },
      { slug: 'troubleshooting', title: 'When something looks wrong', summary: 'What to check first, in order.' },
    ],
  },
];

export const HANDBOOK_PAGES: HandbookPage[] = HANDBOOK.flatMap((part) => part.pages);

export function findPage(slug: string): HandbookPage | undefined {
  return HANDBOOK_PAGES.find((p) => p.slug === slug);
}

/** Previous/next in reading order — the whole point of an ordered TOC. */
export function neighbours(slug: string): { prev?: HandbookPage; next?: HandbookPage } {
  const i = HANDBOOK_PAGES.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { prev: HANDBOOK_PAGES[i - 1], next: HANDBOOK_PAGES[i + 1] };
}

export function partOf(slug: string): HandbookPart | undefined {
  return HANDBOOK.find((part) => part.pages.some((p) => p.slug === slug));
}
