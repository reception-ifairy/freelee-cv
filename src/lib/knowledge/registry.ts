import 'server-only';
import type { KnowledgeChunk, KnowledgeResult } from './types';
import { emptyResult } from './types';

/**
 * Grounding sources — read-only retrieval APIs from the wider iFairy
 * ecosystem, queried alongside a chat turn so answers can cite real
 * curriculum text or Universe canon instead of the model improvising.
 *
 * Same shape as src/lib/ai/registry.ts: one config entry + one fetch
 * function per source. A source that isn't configured, times out, or
 * errors is simply skipped — a knowledge-source outage must never break
 * or meaningfully delay a chat turn.
 */
export type KnowledgeSourceId = 'curriculum' | 'universe';

type SourceConfig = {
  id: KnowledgeSourceId;
  label: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  grantEnv: string;
  path: string;
  /** Normalizes one provider's hit shape into a KnowledgeChunk. */
  mapHit: (hit: Record<string, unknown>) => KnowledgeChunk | null;
};

const SOURCES: Record<KnowledgeSourceId, SourceConfig> = {
  curriculum: {
    id: 'curriculum',
    label: 'UK Curriculum (curriculum.ifairy.co.uk)',
    apiKeyEnv: 'CURRICULUM_API_KEY',
    baseUrlEnv: 'CURRICULUM_API_URL',
    grantEnv: 'CURRICULUM_GRANT',
    path: '/v1/rag/search',
    mapHit(hit) {
      const text = String(hit.text ?? '');
      if (!text) return null;
      return {
        title: String(hit.title ?? 'Curriculum reference'),
        text,
        citation: String(hit.sourceUrl ?? hit.itemId ?? 'curriculum'),
        sourceKey: 'curriculum',
      };
    },
  },
  universe: {
    id: 'universe',
    label: 'iFairy Universe canon',
    apiKeyEnv: 'UNIVERSE_API_KEY',
    baseUrlEnv: 'UNIVERSE_API_URL',
    grantEnv: 'UNIVERSE_GRANT',
    path: '/v1/search',
    mapHit(hit) {
      const chunk = (hit.chunk ?? {}) as Record<string, unknown>;
      const text = String(chunk.text ?? '');
      if (!text) return null;
      return {
        title: String(chunk.title ?? chunk.path ?? 'Universe canon'),
        text,
        citation: chunk.ref ? String(chunk.ref) : `${chunk.module ?? '?'}:${chunk.path ?? '?'}`,
        sourceKey: 'universe',
      };
    },
  },
};

export function isKnowledgeSourceId(value: string): value is KnowledgeSourceId {
  return value in SOURCES;
}

export function availableKnowledgeSources(): SourceConfig[] {
  return Object.values(SOURCES).filter((s) => Boolean(process.env[s.apiKeyEnv]));
}

async function search(sourceId: KnowledgeSourceId, query: string, k: number): Promise<KnowledgeResult> {
  const config = SOURCES[sourceId];
  const apiKey = process.env[config.apiKeyEnv];
  const baseUrl = process.env[config.baseUrlEnv];
  const grant = process.env[config.grantEnv] ?? '';

  if (!apiKey || !baseUrl) return emptyResult(sourceId);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${config.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, grant, k }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return emptyResult(sourceId);

    const body = (await response.json()) as { ok?: boolean; data?: { results?: Record<string, unknown>[] } };
    if (!body.ok) return emptyResult(sourceId);

    const chunks = (body.data?.results ?? [])
      .map((hit) => config.mapHit(hit))
      .filter((c): c is KnowledgeChunk => c !== null);

    return { ok: true, chunks, sourceKey: sourceId };
  } catch {
    return emptyResult(sourceId);
  }
}

/**
 * Fans out to each requested source in parallel and merges the results.
 * Never throws — an unknown or failing source just contributes nothing.
 */
export async function searchMany(
  sourceIds: string[],
  query: string,
  kPerSource = 3,
): Promise<KnowledgeChunk[]> {
  const unique = [...new Set(sourceIds)].filter(isKnowledgeSourceId);
  if (unique.length === 0) return [];

  const results = await Promise.all(unique.map((id) => search(id, query, kPerSource)));
  return results.filter((r) => r.ok).flatMap((r) => r.chunks);
}
