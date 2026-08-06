import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { knowledgeSources, type KnowledgeSourceRow } from '@/db/schema';
import type { KnowledgeChunk, KnowledgeResult } from './types';
import { emptyResult } from './types';

/**
 * Grounding sources — read-only retrieval APIs queried alongside a chat
 * turn so answers can cite real external text instead of the model
 * improvising. DB-backed since 2026-08-06 (replacing a hardcoded
 * `{ curriculum, universe }` record — see docs/18-knowledge-sources.md for
 * why and the two things that changed: sources are now data an admin adds
 * from `/admin/knowledge-sources`, and response parsing is a generic
 * dot-path spec instead of one bespoke function per source).
 *
 * Same "never blocks or breaks a turn" contract as before: an inactive,
 * unreachable, timed-out, or malformed-response source just contributes
 * nothing, never throws.
 */

export const getActiveKnowledgeSources = cache(async (): Promise<KnowledgeSourceRow[]> => {
  return db.select().from(knowledgeSources).where(eq(knowledgeSources.isActive, true));
});

/**
 * Resolves a dot-path like `"data.results"` or `"chunk.text"` against an
 * arbitrary JSON value. Deliberately simple — no array indices, no
 * wildcards, no bracket syntax — this is the "simple REST/JSON API" 80%
 * case, not a full JSONPath implementation. An API whose hits need more
 * than "walk these nested object keys" needs real code, same as an AI
 * provider needing a driver branch in getModel().
 */
function resolvePath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, value);
}

function mapHit(source: KnowledgeSourceRow, hit: unknown): KnowledgeChunk | null {
  if (!hit || typeof hit !== 'object') return null;
  const text = resolvePath(hit, source.textPath);
  if (typeof text !== 'string' || !text) return null;

  const title = resolvePath(hit, source.titlePath);
  const citation = resolvePath(hit, source.citationPath);

  return {
    title: typeof title === 'string' && title ? title : source.label,
    text,
    citation: typeof citation === 'string' && citation ? citation : source.key,
    sourceKey: source.key,
  };
}

async function search(source: KnowledgeSourceRow, query: string, k: number): Promise<KnowledgeResult> {
  if (!source.apiKey || !source.baseUrl) return emptyResult(source.key);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${source.baseUrl.replace(/\/$/, '')}${source.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${source.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, grant: source.grant ?? '', k }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return emptyResult(source.key);

    const body = (await response.json()) as unknown;
    const results = resolvePath(body, source.resultsPath);
    if (!Array.isArray(results)) return emptyResult(source.key);

    const chunks = results.map((hit) => mapHit(source, hit)).filter((c): c is KnowledgeChunk => c !== null);
    return { ok: true, chunks, sourceKey: source.key };
  } catch {
    return emptyResult(source.key);
  }
}

/**
 * Fans out to each requested, active source in parallel and merges the
 * results. Never throws — an unknown, inactive, or failing source just
 * contributes nothing.
 */
export async function searchMany(sourceKeys: string[], query: string, kPerSource = 3): Promise<KnowledgeChunk[]> {
  const requested = new Set(sourceKeys);
  if (requested.size === 0) return [];

  const active = await getActiveKnowledgeSources();
  const matched = active.filter((s) => requested.has(s.key));
  if (matched.length === 0) return [];

  const results = await Promise.all(matched.map((source) => search(source, query, kPerSource)));
  return results.filter((r) => r.ok).flatMap((r) => r.chunks);
}
