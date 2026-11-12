import 'server-only';
import { z } from 'zod';
import { evaluateExpression } from './expression';
import { getSettings, getSettingString } from '@/lib/settings';
import type { CurriculumScope } from '@/db/schema';
import { curriculumConfig, curriculumRequest, failureForModel } from '@/lib/curriculum/client';
import { describeScope, keyStageOfYear, normaliseSubject, yearLabel, yearsFor } from '@/lib/curriculum/scope';
import { CURRICULUM_SCOPE_CACHE_KEY, readScopeCache } from '@/lib/curriculum/stored';
import { CURRICULUM_TOOL_CATALOG, TOOL_CATALOG, type ToolMeta } from './catalog';

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
 * **Most need no API key**, which is deliberate: it keeps the whole path
 * verifiable end to end without signing up for anything. Weather (Open-Meteo)
 * and currency (Frankfurter/ECB) are live network calls that happen to be
 * free and unauthenticated, so they're verified too. Only `web_search` needs
 * a key, and it says so rather than failing mysteriously — see `needsKey`.
 */

export type ToolDefinition = ToolMeta & {
  /** Given to the model. Written for the model, not the admin — it decides when to call. */
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: never) => Promise<unknown> | unknown;
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


/** Shared fetch for the API-backed tools: short timeout, never hangs a chat turn. */
async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** WMO weather codes are integers; a model reads "Light rain" far better than "61". */
function describeWeatherCode(code?: number): string {
  if (code === undefined) return 'Unknown';
  const map: Record<number, string> = {
    0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
  };
  return map[code] ?? `Code ${code}`;
}

const IMPLEMENTATIONS: (Pick<ToolDefinition,'key'|'description'|'inputSchema'|'execute'>)[] = [
  {
    key: 'calculator',
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
  },
  {
    key: 'unit_convert',
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
  },
  {
    key: 'date_math',
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
  },
  {
    key: 'text_stats',
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
  },
  {
    key: 'dice_roll',
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
  },
  {
    key: 'weather',
    description:
      'Look up current weather and a short forecast for a named place. Use this whenever asked about ' +
      'weather — your training data has no idea what today is like. Give the place as a city or town name.',
    inputSchema: z.object({
      place: z.string().describe('e.g. "Warsaw" or "Leeds, UK"'),
      days: z.number().int().min(1).max(7).optional().describe('forecast days, default 3'),
    }),
    execute: async ({ place, days }: { place: string; days?: number }) => {
      try {
        const geo = (await fetchJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`,
        )) as { results?: { name: string; country?: string; latitude: number; longitude: number; timezone: string }[] };

        const found = geo.results?.[0];
        if (!found) return { error: `Could not find a place called "${place}".` };

        const data = (await fetchJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${found.latitude}&longitude=${found.longitude}` +
            `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
            `&timezone=${encodeURIComponent(found.timezone)}&forecast_days=${days ?? 3}`,
        )) as {
          current?: Record<string, number>;
          daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[]; weather_code: number[] };
        };

        return {
          place: [found.name, found.country].filter(Boolean).join(', '),
          current: data.current
            ? {
                temperatureC: data.current.temperature_2m,
                feelsLikeC: data.current.apparent_temperature,
                windKph: data.current.wind_speed_10m,
                conditions: describeWeatherCode(data.current.weather_code),
              }
            : undefined,
          forecast: data.daily?.time.map((date, i) => ({
            date,
            maxC: data.daily!.temperature_2m_max[i],
            minC: data.daily!.temperature_2m_min[i],
            rainChancePercent: data.daily!.precipitation_probability_max[i],
            conditions: describeWeatherCode(data.daily!.weather_code[i]),
          })),
        };
      } catch {
        return { error: 'Could not reach the weather service.' };
      }
    },
  },
  {
    key: 'currency',
    description:
      'Convert between currencies at the current published rate, or look up a rate. Use this rather than ' +
      'recalling a rate — rates move daily and yours are stale. Currencies are ISO codes like GBP, USD, EUR, PLN.',
    inputSchema: z.object({
      from: z.string().describe('ISO code, e.g. "GBP"'),
      to: z.string().describe('ISO code, e.g. "PLN"'),
      amount: z.number().optional().describe('amount to convert, default 1'),
    }),
    execute: async ({ from, to, amount }: { from: string; to: string; amount?: number }) => {
      const base = from.trim().toUpperCase();
      const target = to.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(target)) {
        return { error: 'Currencies must be three-letter ISO codes, e.g. GBP.' };
      }

      try {
        const data = (await fetchJson(
          `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`,
        )) as { date?: string; rates?: Record<string, number> };

        const rate = data.rates?.[target];
        if (typeof rate !== 'number') return { error: `No rate published for ${base} to ${target}.` };

        const value = (amount ?? 1) * rate;
        return { from: base, to: target, rate, amount: amount ?? 1, result: Number(value.toFixed(4)), asOf: data.date };
      } catch {
        return { error: 'Could not reach the exchange-rate service.' };
      }
    },
  },
  {
    key: 'web_search',
    description:
      'Search the web for current information and get back short extracts with source URLs. Use this for ' +
      'anything recent, anything that changes, or anything you are unsure about — and cite the URLs you get back. ' +
      'Do not use it for general knowledge you already have.',
    inputSchema: z.object({
      query: z.string().describe('a focused search query, not a whole question'),
      results: z.number().int().min(1).max(8).optional(),
    }),
    execute: async ({ query, results }: { query: string; results?: number }) => {
      const apiKey = (await getSettingString('tavily_api_key')) || process.env.TAVILY_API_KEY;
      if (!apiKey) return { error: 'Web search is not configured — add a Tavily API key in Settings → AI.' };

      try {
        const data = (await fetchJson('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query, max_results: results ?? 5, search_depth: 'basic' }),
        })) as { answer?: string; results?: { title: string; url: string; content: string }[] };

        return {
          summary: data.answer,
          sources: (data.results ?? []).map((r) => ({ title: r.title, url: r.url, extract: r.content?.slice(0, 400) })),
        };
      } catch {
        return { error: 'Could not reach the search service.' };
      }
    },
  },
];

/**
 * Metadata + implementation, joined on `key`. An implementation with no
 * catalogue entry is dropped rather than silently offered without a label.
 */
export const TOOLS: ToolDefinition[] = IMPLEMENTATIONS.flatMap((impl) => {
  const meta = TOOL_CATALOG.find((m) => m.key === impl.key);
  return meta ? [{ ...meta, ...impl }] : [];
});

export function findTool(key: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.key === key);
}

/* --------------------------- curriculum tutors --------------------------- */

/**
 * How much one curriculum tool call may hand the model, in characters.
 *
 * Like `GROUNDING_MAX_CHARS` in src/lib/persona/prompt.ts this is a price, not
 * a size: ~3,000 characters is ~750 input tokens billed to the customer, and
 * with `stepCountIs(5)` a tool result is resent on every later step of the same
 * turn, so it is paid again for each step that follows it.
 */
const CURRICULUM_MAX_CHARS = 3000;
const CURRICULUM_ITEM_CHARS = 900;
const SEARCH_RESULTS = 4;
/**
 * When the scope has several key stages or subjects and the model picked none,
 * the request goes out without that filter and the hits are narrowed here —
 * so more are asked for, or narrowing could leave nothing.
 */
const SEARCH_RESULTS_WIDE = 10;
const OBJECTIVES_PER_PAGE = 50;

/** In the order offered, so the first one is the default — passages. */
const ITEM_TYPES = ['chunk', 'objective', 'question'] as const;
type ItemType = (typeof ITEM_TYPES)[number];
const ITEM_TYPE_MEANING: Record<ItemType, string> = {
  chunk: 'passages from official curriculum documents',
  objective: 'learning objectives',
  question: 'past test questions',
};

type SearchHit = {
  itemType?: string;
  title?: string | null;
  sourceUrl?: string | null;
  subject?: string | null;
  keyStage?: string | null;
  text?: string | null;
  withheld?: string | null;
};

type Objective = {
  loCode?: string;
  keyStage?: string | null;
  yearGroup?: string | null;
  strand?: string | null;
  statement?: string | null;
  statutory?: boolean | number | null;
};

type ObjectivesPage = { total?: number; objectives?: Objective[] };

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, '')}…` : flat;
}

/**
 * A hit's key stage is a tag — "KS2", "KS1|KS2|KS3", "cross" — matched by
 * containment, as the curriculum's own filter does. "cross" documents apply to
 * every stage (the contract's rule); an untagged one is dropped, because it
 * could be anything and the learner is a child at a known stage.
 */
function keyStageInScope(tag: string | null | undefined, keyStages: readonly string[]): boolean {
  const value = (tag ?? '').toUpperCase();
  if (value.includes('CROSS')) return true;
  return keyStages.some((stage) => value.includes(stage));
}

/** Whole items, dropped from the end — the same rule the grounding section follows. */
function formatHits(hits: SearchHit[]) {
  let budget = CURRICULUM_MAX_CHARS;
  const results: Record<string, unknown>[] = [];

  for (const hit of hits) {
    const title = clip(hit.title || 'Untitled document', 160);
    const item: Record<string, unknown> = { title };
    if (hit.sourceUrl) item.link = hit.sourceUrl;
    if (hit.keyStage) item.keyStage = hit.keyStage;
    if (hit.subject) item.subject = hit.subject;
    if (hit.itemType && hit.itemType !== 'chunk') item.type = hit.itemType;

    // Licence-restricted documents keep their title and link and lose their
    // text (`withheld: "licence"`). The model is told why, so it cites the
    // document instead of paraphrasing text it never saw.
    if (hit.withheld || !hit.text) {
      item.note = hit.withheld
        ? 'Text withheld under its licence: mention the title and link, do not quote or summarise it.'
        : 'No text available: mention the title and link only.';
      budget -= title.length + (hit.sourceUrl?.length ?? 0);
      results.push(item);
      continue;
    }

    if (budget < 200) break;
    item.text = clip(hit.text, Math.min(CURRICULUM_ITEM_CHARS, budget));
    budget -= (item.text as string).length + title.length;
    results.push(item);
  }

  return results;
}

/**
 * The two curriculum tools for one persona version, built for this request as
 * closures over its scope (docs/52-curriculum-tutors.md).
 *
 * The scope is enforced twice, on purpose. The input schema is built from it —
 * a tutor with several key stages or subjects gets an enum of exactly those, so
 * the model is never told a value outside them exists — and `execute` checks
 * again, because a schema is what the model is shown, not a guarantee. The
 * curriculum then applies the key's own scope on its side.
 *
 * Empty when the connection has no key: the tools are not offered at all,
 * rather than offered and failing on every call.
 */
export async function curriculumTools(scope: CurriculumScope): Promise<ToolDefinition[]> {
  const config = await curriculumConfig();
  if (!config) return [];

  const { keyStages, subjects } = scope;
  const years = yearsFor(keyStages);
  const scopeText = describeScope(scope);
  const meta = (key: string) => CURRICULUM_TOOL_CATALOG.find((item) => item.key === key)!;
  const oneOf = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

  // The kinds of material freelee's key may see, from the last Fetch. A kind
  // the key cannot see is a guaranteed 403, so it is not offered; with no
  // Fetch yet, all three are, and the curriculum refuses what it must.
  const fetchedTypes = readScopeCache((await getSettings()).get(CURRICULUM_SCOPE_CACHE_KEY))?.itemTypes ?? [];
  const itemTypes = ITEM_TYPES.filter((type) => fetchedTypes.length === 0 || fetchedTypes.some((row) => row.itemType === type));
  const offeredTypes = itemTypes.length > 0 ? itemTypes : [...ITEM_TYPES];
  // Search defaults to passages; a key that may not see passages gets its first allowed kind instead.
  const defaultType = offeredTypes.includes('chunk') ? undefined : offeredTypes[0];

  const searchShape: Record<string, z.ZodTypeAny> = {
    query: z
      .string()
      .trim()
      .min(2)
      .max(300)
      .describe('The topic only, in a few words — e.g. "equivalent fractions". Never the learner\'s name or other personal details.'),
  };
  if (offeredTypes.length > 1) {
    searchShape.itemType = oneOf(offeredTypes)
      .optional()
      .describe(
        offeredTypes
          .map((type, index) => `${type}${index === 0 ? ' (default)' : ''}: ${ITEM_TYPE_MEANING[type]}`)
          .join('. ') + '.',
      );
  }
  if (keyStages.length > 1) {
    searchShape.keyStage = oneOf(keyStages).optional().describe(`Narrow to one key stage; leave out to search ${keyStages.join(' and ')}.`);
  }
  if (subjects.length > 1) {
    searchShape.subject = oneOf(subjects).optional().describe(`Narrow to one subject; leave out to search ${subjects.join(', ')}.`);
  }

  const objectivesShape: Record<string, z.ZodTypeAny> = {
    subject: oneOf(subjects).optional().describe(subjects.length > 1 ? `One of: ${subjects.join(', ')}.` : `Always ${subjects[0]}.`),
    year: oneOf(years)
      .optional()
      .describe(`A school year, ${years[0]} to ${years[years.length - 1]}.${scope.year ? ` Leave out for ${scope.year}, the learner's year.` : ''}`),
    strand: z.string().trim().max(120).optional().describe('Narrow to one strand, e.g. "Number – fractions". Leave out to see every strand.'),
  };
  if (keyStages.length > 1) {
    objectivesShape.keyStage = oneOf(keyStages).optional().describe('Which key stage, when no year is given.');
  }

  const search: ToolDefinition = {
    ...meta('curriculum_search'),
    description:
      `Look things up in the UK curriculum for this tutor's learners (${scopeText}). Use it before teaching a new topic or ` +
      'stating a curriculum fact — a definition, a method, what a learner at this stage should know. Returns short passages ' +
      'with their source title and link: cite the titles you use. Results never go outside this tutor\'s key stages and subjects.',
    inputSchema: z.object(searchShape),
    execute: async (input: { query: string; itemType?: string; keyStage?: string; subject?: string }) => {
      if (input.keyStage && !keyStages.includes(input.keyStage)) {
        return { error: `This tutor only covers ${keyStages.join(', ')}.` };
      }
      if (input.itemType && !offeredTypes.includes(input.itemType as ItemType)) {
        return { error: `Search one of: ${offeredTypes.join(', ')}.` };
      }
      const itemType = input.itemType ?? defaultType;
      const chosenSubject = input.subject ? normaliseSubject(input.subject) : undefined;
      if (chosenSubject && !subjects.includes(chosenSubject)) {
        return { error: `This tutor only covers ${subjects.join(', ')}.` };
      }

      const keyStage = input.keyStage ?? (keyStages.length === 1 ? keyStages[0] : undefined);
      const subject = chosenSubject ?? (subjects.length === 1 ? subjects[0] : undefined);
      const filters: Record<string, string> = {};
      if (keyStage) filters.key_stage = keyStage;
      if (subject) filters.subject = subject;

      const result = await curriculumRequest<{ results?: SearchHit[] }>(
        config,
        {
          method: 'POST',
          path: '/v1/rag/search',
          body: {
            query: input.query,
            grant: config.grant,
            k: keyStage && subject ? SEARCH_RESULTS : SEARCH_RESULTS_WIDE,
            ...(itemType ? { itemType } : {}),
            filters,
          },
        },
        { cached: true },
      );
      if (!result.ok) return { error: failureForModel('/v1/rag/search', result) };

      const hits = (Array.isArray(result.data?.results) ? result.data.results : [])
        .filter((hit) => keyStageInScope(hit.keyStage, keyStage ? [keyStage] : keyStages))
        .filter((hit) => subjects.includes(normaliseSubject(hit.subject)))
        .slice(0, SEARCH_RESULTS);

      if (hits.length === 0) {
        return {
          results: [],
          note: `The curriculum has nothing on this for ${scopeText}. Tell the learner so plainly rather than inventing an answer.`,
        };
      }
      return { results: formatHits(hits), cite: 'Name the title (and link, if any) of each source you use.' };
    },
  };

  const objectives: ToolDefinition = {
    ...meta('curriculum_objectives'),
    description:
      `List the National Curriculum learning objectives for this tutor's learners (${scopeText}) — what a learner is ` +
      'expected to know in a subject and year. Use it to pitch a lesson at the right level, or to check whether a topic ' +
      'belongs to this stage at all.',
    inputSchema: z.object(objectivesShape),
    execute: async (input: { subject?: string; year?: string; strand?: string; keyStage?: string }) => {
      const subject = input.subject ? normaliseSubject(input.subject) : subjects.length === 1 ? subjects[0] : undefined;
      if (!subject || !subjects.includes(subject)) return { error: `Name a subject: ${subjects.join(', ')}.` };
      if (input.year && !years.includes(input.year)) return { error: `Pick a year from ${years.join(', ')}.` };
      if (input.keyStage && !keyStages.includes(input.keyStage)) {
        return { error: `This tutor only covers ${keyStages.join(', ')}.` };
      }

      // The learner's own year is the default, unless the model asked about a
      // different key stage on purpose.
      const year =
        input.year ??
        (scope.year && (!input.keyStage || keyStageOfYear(scope.year) === input.keyStage) ? scope.year : undefined);
      const keyStage = year ? keyStageOfYear(year) : input.keyStage ?? (keyStages.length === 1 ? keyStages[0] : undefined);
      if (!keyStage) return { error: `Name a year or a key stage: ${keyStages.join(', ')}.` };

      const ask = (withYear?: string) =>
        curriculumRequest<ObjectivesPage>(
          config,
          {
            method: 'GET',
            path: '/v1/objectives',
            query: { key_stage: keyStage, subject, year: withYear, strand: input.strand, per: OBJECTIVES_PER_PAGE },
          },
          { cached: true },
        );

      let result = await ask(year);
      let note: string | undefined;
      // Only maths and science objectives are tagged to single years; the rest
      // are tagged to a pair of years or the whole key stage. An empty answer
      // for "Y4 history" means "ask for KS2", not "there is no history".
      if (result.ok && year && !(result.data?.objectives?.length)) {
        const wider = await ask(undefined);
        if (wider.ok && wider.data?.objectives?.length) {
          result = wider;
          note = `No ${subject} objectives are tagged ${yearLabel(year)} on their own; these cover ${keyStage} as a whole.`;
        }
      }
      if (!result.ok) return { error: failureForModel('/v1/objectives', result) };

      const rows = (Array.isArray(result.data?.objectives) ? result.data.objectives : []).filter((row) =>
        keyStages.includes(String(row.keyStage ?? '').toUpperCase()),
      );
      if (rows.length === 0) {
        return {
          objectives: [],
          note: input.strand
            ? `Nothing in a strand called "${input.strand}". Call again without a strand to see which strands exist.`
            : `The curriculum lists no ${subject} objectives for ${keyStage}. Say so plainly rather than inventing them.`,
        };
      }

      let budget = CURRICULUM_MAX_CHARS;
      const kept: Record<string, unknown>[] = [];
      for (const row of rows) {
        const item: Record<string, unknown> = { code: row.loCode, statement: clip(row.statement ?? '', 400) };
        if (row.yearGroup) item.year = row.yearGroup;
        if (row.strand) item.strand = row.strand;
        if (row.statutory !== undefined && row.statutory !== null) item.statutory = Boolean(row.statutory);
        const size = JSON.stringify(item).length;
        if (size > budget) break;
        budget -= size;
        kept.push(item);
      }

      const total = typeof result.data?.total === 'number' ? result.data.total : rows.length;
      const more = total > kept.length ? `Showing ${kept.length} of ${total}. Pass a strand to see the rest of one area.` : undefined;
      return {
        keyStage,
        subject,
        ...(year && !note ? { year } : {}),
        objectives: kept,
        ...(note || more ? { note: [note, more].filter(Boolean).join(' ') } : {}),
        cite: 'Cite these as National Curriculum learning objectives, with the code.',
      };
    },
  };

  // Listing objectives is the "objective" kind of material; a key that may not
  // see it would be refused on every call.
  return offeredTypes.includes('objective') ? [search, objectives] : [search];
}

export { isToolKey, suggestedToolsFor, TOOL_CATALOG } from './catalog';
