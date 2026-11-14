/**
 * Tool *metadata* — no implementations, no server imports.
 *
 * Split from `registry.ts` because the admin persona form is a client
 * component and needs to list tools, while the implementations reach for
 * settings and the network and are `server-only`. Importing the registry from
 * the client pulled `server-only` into the browser bundle and failed the
 * build — the same split already made for `src/lib/ai/provider-ids.ts`.
 *
 * The registry imports this and attaches an `execute` to each entry, so the
 * two can't drift: a tool missing from here simply isn't offered.
 */
export type ToolMeta = {
  key: string;
  label: string;
  /** Shown in the admin picker. */
  summary: string;
  /** Category slugs where this tool is suggested by default. */
  suggestFor: string[];
  /** Shown in the picker so a tool that will refuse until configured is visibly marked. */
  needsKey?: boolean;
};

export const TOOL_CATALOG: ToolMeta[] = [
  {
    key: 'calculator',
    label: 'Calculator',
    summary: 'Arithmetic the model would otherwise guess at.',
    suggestFor: [
      'business-and-finance', 'science-and-research', 'engineering-and-architecture',
      'education-and-training', 'environment-and-sustainability', 'technology-and-web-development',
    ],
  },
  {
    key: 'unit_convert',
    label: 'Unit converter',
    summary: 'Length, mass, volume and temperature, exactly.',
    suggestFor: [
      'engineering-and-architecture', 'science-and-research', 'health-and-medicine',
      'travel-and-hospitality', 'education-and-training', 'environment-and-sustainability',
    ],
  },
  {
    key: 'date_math',
    label: 'Date calculator',
    summary: 'Days between dates, and dates in the future or past.',
    suggestFor: ['travel-and-hospitality', 'business-and-finance', 'legal-and-compliance', 'human-resources-and-career-development'],
  },
  {
    key: 'text_stats',
    label: 'Text statistics',
    summary: 'Word and character counts, reading time.',
    suggestFor: [
      'writing-and-content-creation', 'marketing-and-advertising', 'digital-marketing',
      'creative-arts-and-design', 'translation-and-localisation', 'education-and-training',
    ],
  },
  {
    key: 'dice_roll',
    label: 'Dice & random choice',
    summary: 'Real randomness for stories and games.',
    suggestFor: ['entertainment-and-media', 'creative-arts-and-design'],
  },
  {
    key: 'weather',
    label: 'Weather',
    summary: 'Live conditions and forecast for any place. No key needed.',
    suggestFor: ['travel-and-hospitality', 'environment-and-sustainability', 'engineering-and-architecture', 'lifestyle-and-wellness'],
  },
  {
    key: 'currency',
    label: 'Currency rates',
    summary: "Today's exchange rates from the European Central Bank. No key needed.",
    suggestFor: ['business-and-finance', 'travel-and-hospitality', 'sales-and-customer-support', 'marketing-and-advertising'],
  },
  {
    key: 'web_search',
    label: 'Web search',
    summary: 'Current information from the live web, with source URLs.',
    suggestFor: [
      'business-and-finance', 'science-and-research', 'legal-and-compliance', 'emerging-technologies',
      'marketing-and-advertising', 'digital-marketing', 'entertainment-and-media', 'environment-and-sustainability',
    ],
    needsKey: true,
  },
];

/**
 * The curriculum tutor's two tools (docs/52-curriculum-tutors.md).
 *
 * Deliberately **not** in `TOOL_CATALOG`, so they never appear among the
 * tickable tools and can never land in `persona_versions.tools`. They are
 * switched on by a version's `curriculum_scope` and built per request around
 * it — a curriculum tool without a scope would have nothing to stay inside,
 * and one ticked without a scope would search every key stage for a
 * seven-year-old. Listed here so the persona form can name them.
 */
export const CURRICULUM_TOOL_CATALOG: ToolMeta[] = [
  {
    key: 'curriculum_search',
    label: 'Search the curriculum',
    summary: 'Passages from official documents, learning objectives and test questions — only within the tutor’s key stages and subjects.',
    suggestFor: [],
    needsKey: true,
  },
  {
    key: 'curriculum_objectives',
    label: 'Curriculum objectives',
    summary: 'What a learner in a given year and subject is expected to know, straight from the National Curriculum.',
    suggestFor: [],
    needsKey: true,
  },
  {
    key: 'exam_practice',
    label: 'Exam practice',
    summary: 'In a child’s lesson, one published test question at a time for their target exam (KS2 grammar and arithmetic), never one they had before.',
    suggestFor: [],
    needsKey: true,
  },
];

export const TOOL_KEYS = TOOL_CATALOG.map((t) => t.key);

export function isToolKey(key: string): boolean {
  return TOOL_KEYS.includes(key);
}

/** Which tools to pre-tick for a persona in these categories. */
export function suggestedToolsFor(categorySlugs: string[]): string[] {
  return TOOL_CATALOG.filter((tool) => tool.suggestFor.some((slug) => categorySlugs.includes(slug))).map((t) => t.key);
}
