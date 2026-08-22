import 'server-only';
import { embedMany } from 'ai';
import { getProviderRegistry, findEmbeddingModel, getEmbeddingModel, resolveProviderKeys } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';

/**
 * Turning passages into vectors.
 *
 * The dimension count is fixed at 1536 by the column type, and that is not an
 * arbitrary number: pgvector 0.6.0 — the newest packaged for Ubuntu 24.04 —
 * indexes at most 2,000 dimensions, so `text-embedding-3-large`'s 3,072 could
 * never be indexed on this server even if the 6.5x price were worth paying.
 *
 * Vectors from two different models are not comparable. Anything written here
 * therefore records which model produced it (`library_documents.embedding_model`),
 * so "which books still need re-embedding" is answerable by query rather than
 * by memory.
 */

/**
 * OpenAI accepts far larger batches, but a batch is also the unit of retry and
 * of memory: 96 passages is ~350 KB of text out and ~590 KB of floats back,
 * which keeps a failure cheap to repeat and the heap flat over a 600-passage
 * book.
 */
export const EMBED_BATCH = 96;

/** Concurrency across batches. Four is polite to the rate limit and still saturates the wire. */
const MAX_PARALLEL = 4;

export const EMBED_DIMENSIONS = 1536;

export type EmbedResult =
  | { ok: true; vectors: number[][]; tokens: number; model: string }
  | { ok: false; error: string };

/** Which model the library embeds with right now, or null if none is configured. */
export async function activeEmbeddingModel(): Promise<{ providerId: string; modelId: string } | null> {
  const [registry, preferred] = await Promise.all([
    getProviderRegistry(),
    getSettingString('library_embedding_model'),
  ]);
  return findEmbeddingModel(registry, preferred || null);
}

/**
 * Embed a list of passages, in order.
 *
 * Returns `{ ok: false }` rather than throwing for a configuration problem
 * (no model, no key), because that is a message the panel should show a person
 * — not a stack trace. A transport failure *does* throw, so the job queue can
 * retry it.
 */
export async function embedPassages(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { ok: true, vectors: [], tokens: 0, model: '' };

  const [registry, preferred] = await Promise.all([
    getProviderRegistry(),
    getSettingString('library_embedding_model'),
  ]);
  const choice = findEmbeddingModel(registry, preferred || null);
  if (!choice) {
    return {
      ok: false,
      error: 'No embedding model is set up yet. Add one under Admin → Settings → AI models, then try again.',
    };
  }

  const keys = await resolveProviderKeys(choice.providerId);
  if (!keys.apiKey && choice.providerId !== 'ollama') {
    return {
      ok: false,
      error: `The ${choice.providerId} API key is missing. Add it under Admin → Settings → AI, then try again.`,
    };
  }

  const model = getEmbeddingModel(registry, choice.providerId, choice.modelId, keys);

  const vectors: number[][] = [];
  let tokens = 0;

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const result = await embedMany({ model, values: batch, maxParallelCalls: MAX_PARALLEL, maxRetries: 3 });
    vectors.push(...result.embeddings);
    tokens += result.usage?.tokens ?? 0;
  }

  const wrongSize = vectors.find((v) => v.length !== EMBED_DIMENSIONS);
  if (wrongSize) {
    // A model whose output does not fit the column would fail at INSERT with a
    // Postgres error nobody can act on. Caught here, where the cause is known.
    return {
      ok: false,
      error: `${choice.modelId} returns ${wrongSize.length}-dimension vectors, but the library stores ${EMBED_DIMENSIONS}. Choose a ${EMBED_DIMENSIONS}-dimension model.`,
    };
  }

  return { ok: true, vectors, tokens, model: choice.modelId };
}

/** The pgvector literal form: `[0.1,0.2,…]`. postgres.js has no vector codec of its own. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
