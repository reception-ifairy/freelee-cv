import { z } from 'zod';
import { evaluateExpression } from './expression';

/**
 * Tools a persona can actually invoke mid-conversation.
 *
 * Until now a persona could only ever *talk* — knowledge sources let it read,
 * guardrails shaped what it said, but nothing let it compute or act. A model
 * asked to add up a column of numbers would guess, confidently and sometimes
 * wrongly. These close that gap.
 *
 * **Static registry, not DB rows** — the same distinction the AI provider
 * registry draws. A tool is *code*: it has an implementation, a schema and a
 * failure mode. Which tools a persona may use is data (`persona_versions.tools`);
 * the tools themselves cannot be.
 *
 * Every tool here works with **no API key**, which is deliberate for the first
 * set: it makes the whole path verifiable end to end without signing up for
 * anything. API-backed tools (search, weather, market data) slot into the same
 * shape and are the natural next addition.
 */

export type ToolCategoryHint = string;

export type ToolDefinition = {
  key: string;
  label: string;
  /** Shown in the admin picker. */
  summary: string;
  /** Given to the model. Written for the model, not the admin — it decides when to call. */
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: never) => Promise<unknown> | unknown;
  /** Category slugs where this tool is suggested by default. */
  suggestFor: ToolCategoryHint[];
  /** True when it needs credentials — none do yet. */
  needsKey?: boolean;
};

const UNITS: Record<string, { base: number; kind: string }> = {
  // length (base: metre)
  mm: { base: 0.001, kind: 'length' }, cm: { base: 0.01, kind: 'length' }, m: { base: 1, kind: 'length' },
  km: { base: 1000, kind: 'length' }, in: { base: 0.0254, kind: 'length' }, ft: { base: 0.3048, kind: 'length' },
  yd: { base: 0.9144, kind: 'length' }, mi: { base: 1609.344, kind: 'length' },
  // mass (base: kilogram)
  g: { base: 0.001, kind: 'mass' }, kg: { base: 1, kind: 'mass' }, t: { base: 1000, kind: 'mass' },
  oz: { base: 0.028349523125, kind: 'mass' }, lb: { base: 0.45359237, kind: 'mass' }, st: { base: 6.35029318, kind: 'mass' },
  // volume (base: litre)
  ml: { base: 0.001, kind: 'volume' }, l: { base: 1, kind: 'volume' },
  pt: { base: 0.56826125, kind: 'volume' }, gal: { base: 4.54609, kind: 'volume' },
};

/** Temperature is affine, not a simple ratio, so it can't live in the table above. */
function convertTemperature(value: number, from: string, to: string): number | null {
  const toC = from === 'c' ? value : from === 'f' ? (value - 32) * (5 / 9) : from === 'k' ? value - 273.15 : null;
  if (toC === null) return null;
  return to === 'c' ? toC : to === 'f' ? toC * (9 / 5) + 32 : to === 'k' ? toC + 273.15 : null;
}

export const TOOLS: ToolDefinition[] = [
  {
    key: 'calculator',
    label: 'Calculator',
    summary: 'Arithmetic the model would otherwise guess at.',
    description:
      'Evaluate an arithmetic expression exactly. Use this for ANY calculation rather than working it out yourself — ' +
      'you are unreliable at arithmetic and this is not. Supports + - * / % ^, parentheses, and ' +
      'sqrt, abs, round, floor, ceil, ln, log, sin, cos, tan, plus the constants pi and e.',
    inputSchema: z.object({ expression: z.string().describe('e.g. "1234 * 0.175" or "sqrt(2) * 100"') }),
    execute: ({ expression }: { expression: string }) => {
      try {
        return { result: evaluateExpression(expression), expression };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Could not evaluate that.' };
      }
    },
    suggestFor: [
      'business-and-finance', 'science-and-research', 'engineering-and-architecture',
      'education-and-training', 'environment-and-sustainability', 'technology-and-web-development',
    ],
  },
  {
    key: 'unit_convert',
    label: 'Unit converter',
    summary: 'Length, mass, volume and temperature, exactly.',
    description:
      'Convert a value between units. Units: mm cm m km in ft yd mi (length); g kg t oz lb st (mass); ' +
      'ml l pt gal (volume); c f k (temperature). Use this instead of recalling conversion factors.',
    inputSchema: z.object({
      value: z.number(),
      from: z.string().describe('unit code, e.g. "kg"'),
      to: z.string().describe('unit code, e.g. "lb"'),
    }),
    execute: ({ value, from, to }: { value: number; from: string; to: string }) => {
      const a = from.toLowerCase().trim();
      const b = to.toLowerCase().trim();

      const temperature = convertTemperature(value, a, b);
      if (temperature !== null) return { result: Number(temperature.toFixed(4)), from: a, to: b };

      const source = UNITS[a];
      const target = UNITS[b];
      if (!source || !target) return { error: `Unknown unit: ${!source ? a : b}` };
      if (source.kind !== target.kind) return { error: `Cannot convert ${source.kind} to ${target.kind}.` };

      return { result: Number(((value * source.base) / target.base).toFixed(6)), from: a, to: b };
    },
    suggestFor: [
      'engineering-and-architecture', 'science-and-research', 'health-and-medicine',
      'travel-and-hospitality', 'education-and-training', 'environment-and-sustainability',
    ],
  },
  {
    key: 'date_math',
    label: 'Date calculator',
    summary: 'Days between dates, and dates in the future or past.',
    description:
      'Work with dates exactly. Either the number of days between two dates, or the date a number of days ' +
      'from a starting date. Use this rather than counting — you get date arithmetic wrong, especially across ' +
      'month and year boundaries. Dates are ISO format (YYYY-MM-DD). "today" is accepted.',
    inputSchema: z.object({
      operation: z.enum(['difference', 'add']),
      from: z.string().describe('YYYY-MM-DD or "today"'),
      to: z.string().optional().describe('YYYY-MM-DD, for "difference"'),
      days: z.number().optional().describe('days to add (may be negative), for "add"'),
    }),
    execute: ({ operation, from, to, days }: { operation: 'difference' | 'add'; from: string; to?: string; days?: number }) => {
      const parse = (value: string) => (value.trim().toLowerCase() === 'today' ? new Date() : new Date(`${value}T00:00:00Z`));
      const start = parse(from);
      if (Number.isNaN(start.getTime())) return { error: `Cannot read the date "${from}".` };

      if (operation === 'difference') {
        if (!to) return { error: 'A "to" date is required for a difference.' };
        const end = parse(to);
        if (Number.isNaN(end.getTime())) return { error: `Cannot read the date "${to}".` };
        const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
        return { days: diff, weeks: Number((diff / 7).toFixed(2)) };
      }

      if (days === undefined) return { error: 'A "days" value is required to add.' };
      const result = new Date(start.getTime() + days * 86_400_000);
      return { date: result.toISOString().slice(0, 10), weekday: result.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) };
    },
    suggestFor: ['travel-and-hospitality', 'business-and-finance', 'legal-and-compliance', 'human-resources-and-career-development'],
  },
  {
    key: 'text_stats',
    label: 'Text statistics',
    summary: 'Word and character counts, reading time.',
    description:
      'Count words, characters and sentences in a piece of text, and estimate reading time. Use this whenever ' +
      'asked how long something is, or to check a draft against a word limit — do not estimate.',
    inputSchema: z.object({ text: z.string() }),
    execute: ({ text }: { text: string }) => {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return {
        words,
        characters: text.length,
        charactersNoSpaces: text.replace(/\s/g, '').length,
        sentences: (text.match(/[.!?]+(\s|$)/g) ?? []).length,
        readingMinutes: Math.max(1, Math.ceil(words / 200)),
      };
    },
    suggestFor: [
      'writing-and-content-creation', 'marketing-and-advertising', 'digital-marketing',
      'creative-arts-and-design', 'translation-and-localisation', 'education-and-training',
    ],
  },
  {
    key: 'dice_roll',
    label: 'Dice & random choice',
    summary: 'Real randomness for stories and games.',
    description:
      'Roll dice or pick randomly from a list. Use this whenever an outcome should be genuinely uncertain — ' +
      'you cannot produce real randomness yourself and will unconsciously favour certain results.',
    inputSchema: z.object({
      sides: z.number().int().min(2).max(1000).optional().describe('e.g. 20 for a d20'),
      count: z.number().int().min(1).max(20).optional(),
      choices: z.array(z.string()).min(2).max(50).optional().describe('pick one of these instead of rolling'),
    }),
    execute: ({ sides, count, choices }: { sides?: number; count?: number; choices?: string[] }) => {
      if (choices?.length) return { picked: choices[Math.floor(Math.random() * choices.length)] };
      const faces = sides ?? 6;
      const rolls = Array.from({ length: count ?? 1 }, () => 1 + Math.floor(Math.random() * faces));
      return { rolls, total: rolls.reduce((a, b) => a + b, 0), sides: faces };
    },
    suggestFor: ['entertainment-and-media', 'creative-arts-and-design'],
  },
];

export const TOOL_KEYS = TOOLS.map((t) => t.key);

export function findTool(key: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.key === key);
}

export function isToolKey(key: string): boolean {
  return TOOL_KEYS.includes(key);
}

/** Which tools to pre-tick for a persona in these categories. */
export function suggestedToolsFor(categorySlugs: string[]): string[] {
  return TOOLS.filter((tool) => tool.suggestFor.some((slug) => categorySlugs.includes(slug))).map((t) => t.key);
}
