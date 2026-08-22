import 'server-only';
import type { KnowledgeChunk } from './types';
import { searchMany } from './registry';
import { searchLibrary } from '@/lib/library/search';

/**
 * One dispatcher for everything that can ground an answer.
 *
 * A persona has always carried a single `grounding_sources` array of keys.
 * Rather than give it a second array for the local library — which would mean
 * a second validation branch, a second checkbox group, a second call site in
 * the chat route and merge logic between two lists — a library shelf is just
 * another key, distinguished by a `lib:` prefix.
 *
 * The prefix is doing real work: it makes the two kinds impossible to confuse
 * at a glance in the database, and it means adding a third kind of source
 * later is a new prefix rather than a new column.
 *
 * Both legs run in parallel and neither can break a turn — `searchMany` never
 * throws by contract, and `searchLibrary` returns nothing when the embedding
 * model or key is missing.
 */

export const LIBRARY_PREFIX = 'lib:';

export function isLibraryKey(key: string): boolean {
  return key.startsWith(LIBRARY_PREFIX);
}

export function splitGroundingKeys(keys: string[]): { remote: string[]; collections: string[] } {
  const remote: string[] = [];
  const collections: string[] = [];
  for (const key of keys) {
    if (isLibraryKey(key)) collections.push(key.slice(LIBRARY_PREFIX.length));
    else remote.push(key);
  }
  return { remote, collections };
}

export async function searchGrounding(keys: string[], query: string): Promise<KnowledgeChunk[]> {
  if (keys.length === 0 || !query.trim()) return [];
  const { remote, collections } = splitGroundingKeys(keys);

  const [remoteChunks, libraryChunks] = await Promise.all([
    remote.length > 0 ? searchMany(remote, query) : Promise.resolve([]),
    collections.length > 0 ? searchLibrary(collections, query) : Promise.resolve([]),
  ]);

  // Library passages first: they are the operator's own curated material, and
  // the grounding section is truncated from the end when it runs long.
  return [...libraryChunks, ...remoteChunks];
}

/**
 * Every key a persona may be granted, remote and local together, ready for the
 * one checkbox group on the persona form.
 *
 * Built here rather than in the pages so the two persona routes (new and edit)
 * cannot drift apart, and so the *same* list is what validation checks against
 * on save — a key offered by the form and rejected by the action would be a
 * silent data-loss bug.
 */
export type GroundingOption = { key: string; label: string; hint?: string };

export async function groundingOptions(): Promise<GroundingOption[]> {
  const { getActiveKnowledgeSources } = await import('./registry');
  const { listCollections } = await import('@/lib/library/queries');

  const [sources, collections] = await Promise.all([getActiveKnowledgeSources(), listCollections()]);

  return [
    ...collections
      .filter((c) => c.isActive)
      .map((c) => ({
        key: `${LIBRARY_PREFIX}${c.key}`,
        label: c.label,
        hint: c.documents === 0
          ? 'no documents yet'
          : `${c.documents} document${c.documents === 1 ? '' : 's'} · ${c.passages.toLocaleString()} passages`,
      })),
    ...sources.map((s) => ({ key: s.key, label: s.label, hint: 'remote source' })),
  ];
}
