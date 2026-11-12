import 'server-only';
import { createHash } from 'node:crypto';
import { getSettingString } from '@/lib/settings';

/**
 * The one way freelee talks to curriculum.ifairy.co.uk
 * (docs/52-curriculum-tutors.md). Used by the connection card's Test and Fetch
 * and by the two tutor tools, so all three send the same headers, time out the
 * same way and read errors the same way.
 *
 * Never logs or stores what was asked. The end users of a curriculum tutor are
 * children; the curriculum side logs only which items it served, and this side
 * keeps the request body nowhere but the short in-memory cache below.
 */

export const CURRICULUM_DEFAULT_BASE_URL = 'https://curriculum.ifairy.co.uk';
export const CURRICULUM_DEFAULT_GRANT = 'curriculum-rag';

export type CurriculumConfig = { baseUrl: string; apiKey: string; grant: string };

/** Saved settings first, then the env file for the key, then the defaults. Null when there is no key. */
export async function curriculumConfig(): Promise<CurriculumConfig | null> {
  const apiKey = (await getSettingString('curriculum_api_key')) || process.env.CURRICULUM_API_KEY || '';
  if (!apiKey) return null;
  const baseUrl = (await getSettingString('curriculum_base_url', CURRICULUM_DEFAULT_BASE_URL)).replace(/\/+$/, '');
  const grant = await getSettingString('curriculum_grant', CURRICULUM_DEFAULT_GRANT);
  return { baseUrl, apiKey, grant };
}

export type CurriculumResult<T> =
  | { ok: true; data: T }
  /**
   * `status` null: nothing answered (network, timeout). Otherwise the HTTP
   * status — 200 included, when the answer was not the curriculum's JSON.
   * `error` is the curriculum's own words when it gave any.
   */
  | { ok: false; status: number | null; error: string; retryAfter?: string };

type CurriculumCall = {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
};

/**
 * A chat turn waits on this. Eight seconds is long for a search and short
 * enough that a stalled curriculum server costs the learner one pause, not a
 * reply that never comes.
 */
const TOOL_TIMEOUT_MS = 8_000;

/* --------------------------------- cache --------------------------------- */

/**
 * A small in-process cache for the tutor tools.
 *
 * Children ask the same thing many times ("what is a fraction"), a tutor
 * re-checks a topic on every step of a lesson, and the AI SDK may call the same
 * tool twice in one turn. Each of those is a request against the key's daily
 * limit and, for search, an embedding on the curriculum's side.
 *
 * Ten minutes, because curriculum content changes by deploy, not by the
 * minute, while a scope change made in T1000 should still show up the same
 * lesson. Capped at 500 entries (~a few MB at most) and oldest-first eviction —
 * a Map keeps insertion order, so no extra structure is needed. Per process,
 * not shared: a restart empties it, which is fine.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; data: unknown }>();

function cacheKey(config: CurriculumConfig, request: CurriculumCall): string {
  // The key's fingerprint, not the key: a new key may have a different scope,
  // and its answers must not be served from the old one's.
  const keyId = createHash('sha256').update(config.apiKey).digest('hex').slice(0, 12);
  return JSON.stringify([config.baseUrl, keyId, request.method, request.path, request.query ?? null, request.body ?? null]);
}

function cacheGet(key: string): unknown {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function cacheSet(key: string, data: unknown) {
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

/* -------------------------------- request -------------------------------- */

/** Every curriculum answer is `{ ok, data }` or `{ ok: false, error }`; anything else is not the curriculum. */
function parseEnvelope(text: string): { ok?: unknown; data?: unknown; error?: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as { ok?: unknown; data?: unknown; error?: unknown }) : null;
  } catch {
    return null;
  }
}

/**
 * One call. Never throws: every failure comes back as `{ ok: false }` so the
 * caller can turn it into words — a card message, or a sentence for the model.
 *
 * `cached` is for the tutor tools only. Test and Fetch always ask the server,
 * since their whole point is what it says right now.
 */
export async function curriculumRequest<T>(
  config: CurriculumConfig,
  request: CurriculumCall,
  options: { cached?: boolean; timeoutMs?: number } = {},
): Promise<CurriculumResult<T>> {
  const key = options.cached ? cacheKey(config, request) : null;
  if (key) {
    const hit = cacheGet(key);
    if (hit !== undefined) return { ok: true, data: hit as T };
  }

  const url = new URL(`${config.baseUrl}${request.path}`);
  for (const [name, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(name, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? TOOL_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: null, error: 'unreachable' };
  }

  const text = await response.text().catch(() => '');
  const body = parseEnvelope(text);

  if (!response.ok || !body || body.ok === false) {
    const error = typeof body?.error === 'string' ? body.error : text.slice(0, 200);
    return {
      ok: false,
      status: response.status,
      error,
      retryAfter: response.headers.get('retry-after') ?? undefined,
    };
  }

  if (key) cacheSet(key, body.data);
  return { ok: true, data: body.data as T };
}

/**
 * A failed call as one sentence for the model. Short and actionable for a
 * tutor mid-lesson: it should tell the learner it could not check, not guess.
 * The details go to the server log — status and route only, never the request.
 */
export function failureForModel(path: string, result: Extract<CurriculumResult<unknown>, { ok: false }>): string {
  // The curriculum's error texts name a route, a grant or a scope value —
  // never the request — so they are safe to log, and they say what went wrong.
  console.warn(`[curriculum] ${path} failed: ${result.status === null ? 'no answer' : `HTTP ${result.status} ${result.error.slice(0, 120)}`}`);

  if (result.status === 403 && /scope/i.test(result.error)) {
    return 'That is outside what this tutor may look up. Stay within your key stages and subjects.';
  }
  if (result.status === 429) {
    return 'The curriculum has had too many requests for now. Tell the learner you cannot check the curriculum at the moment, rather than guessing.';
  }
  // The pre-2026-11 guard refused anything that looked like personal details
  // instead of redacting it. Asking again with only the topic works.
  if (result.status === 400 && /personal information/i.test(result.error)) {
    return 'The curriculum would not search that because it looked like personal details. Search again with only the topic.';
  }
  return 'Curriculum is not available right now. Tell the learner you cannot check the curriculum at the moment, rather than guessing.';
}
