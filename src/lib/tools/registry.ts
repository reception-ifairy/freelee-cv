import 'server-only';
import { z } from 'zod';
import { evaluateExpression } from './expression';
import { getSettingString } from '@/lib/settings';
import { TOOL_CATALOG, type ToolMeta } from './catalog';

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

export { isToolKey, suggestedToolsFor, TOOL_CATALOG } from './catalog';
