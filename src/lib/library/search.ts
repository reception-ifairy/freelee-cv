import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { KnowledgeChunk } from '@/lib/knowledge/types';
import { embedPassages, toVectorLiteral } from './embed';

/**
 * Finding the passages worth putting in front of the model.
 *
 * Returns the **existing** `KnowledgeChunk` shape that `searchMany` returns, so
 * library results drop into the `## Grounding` section beside external-source
 * results and nothing upstream has to learn a new type.
 *
 * ## Why hybrid, and the trap in it
 *
 * Vector search is good at "what does the literature say about slack capacity"
 * and bad at the things an academic corpus is full of: a statute number, a
 * named theorem, an author's surname, a term of art. Keyword search is the
 * reverse. The GIN index costs nothing to maintain, so there is no reason to
 * pick one.
 *
 * The trap is `websearch_to_tsquery`, which **ANDs every term**. Given a
 * conversational question — "what does the author say about how guilds
 * regulated apprenticeships in Flanders?" — it builds a nine-term AND that
 * matches zero rows, reciprocal-rank fusion silently degenerates to pure
 * vector search, and every test still passes. So the query is built as an OR
 * of the question's own lexemes, and it is built **inside Postgres**
 * (`unnest(to_tsvector(...))` piped through `quote_literal`) rather than by
 * concatenating strings in JavaScript, which is both safer and shorter.
 *
 * ## Why exact, not HNSW
 *
 * pgvector 0.6.0 — the newest packaged for Ubuntu 24.04 — applies a WHERE
 * filter *after* the approximate scan, so a query restricted to one collection
 * can come back with two rows or none. `hnsw.iterative_scan` fixes exactly
 * that and arrived in 0.8.0. An exact scan has perfect recall, no build step
 * and no `ef_search` to tune; at this corpus size it is a few hundred
 * milliseconds provided `shared_buffers` can hold the vectors. Add the index
 * when a measured p95 says to, not before.
 */

/** Candidates pulled from each leg before fusion. */
const CANDIDATES = 40;

/**
 * Reciprocal-rank fusion constant. 60 is the value from the original paper and
 * is deliberately large: it flattens the difference between rank 1 and rank 5,
 * so a passage both legs agree on beats one that either leg ranked first.
 */
const RRF_K = 60;

/** At most this many passages from any one document, so a verbose book cannot crowd the shelf. */
const PER_DOCUMENT = 2;

/**
 * Below this cosine similarity a passage is not an answer, it is just the
 * nearest thing in the room.
 *
 * Vector search has no concept of "no match" — it always returns its top k,
 * so without a floor a question the library cannot answer comes back with a
 * confidently irrelevant passage, which the model then grounds its answer in.
 * That is worse than returning nothing.
 *
 * 0.25 is measured, not guessed. Against the first ingested corpus:
 *
 *     on topic   0.43 – 0.74
 *     related    0.26 – 0.28
 *     off topic  0.008 – 0.04
 *     nonsense   0.04 – 0.15
 *
 * The gap between "related" and "nonsense" is wide and the floor sits in it.
 * Worth re-measuring as the library grows — the panel's test-question box
 * shows these scores precisely so that is a five-minute check rather than a
 * research project.
 */
const MIN_SIMILARITY = 0.25;

export type SearchOptions = {
  /** Passages to return before neighbour expansion. */
  k?: number;
  /**
   * Fetch each hit's immediate neighbours and stitch them in. This is what
   * pays for passages being small: precision at search time, context at answer
   * time. Set 0 for the cheapest possible retrieval.
   */
  expand?: 0 | 1;
  /**
   * Hard ceiling on the text handed back, enforced by dropping whole passages
   * from the end. Every other knob (k, expansion, passage size) can only move
   * cost around underneath this one — which is why the budget lives here and
   * not in the caller.
   */
  maxChars?: number;
};

type Hit = { chunkId: number; documentId: string; position: number; score: number };

type Row = {
  chunk_id: number;
  document_id: string;
  position: number;
  score: number;
};

function fuse(legs: Hit[][]): Map<number, Hit> {
  const fused = new Map<number, Hit>();
  for (const leg of legs) {
    leg.forEach((hit, index) => {
      const existing = fused.get(hit.chunkId);
      const contribution = 1 / (RRF_K + index + 1);
      if (existing) existing.score += contribution;
      else fused.set(hit.chunkId, { ...hit, score: contribution });
    });
  }
  return fused;
}

export async function searchLibrary(
  collectionKeys: string[],
  query: string,
  options: SearchOptions = {},
): Promise<KnowledgeChunk[]> {
  const k = options.k ?? 5;
  const expand = options.expand ?? 1;
  const maxChars = options.maxChars ?? 9000;

  const text = query.trim();
  if (!text || collectionKeys.length === 0) return [];

  const embedded = await embedPassages([text]);
  // A missing key or model must not break a chat turn — the same contract
  // `searchMany` keeps for an unreachable external source.
  if (!embedded.ok || embedded.vectors.length === 0) return [];
  const vector = toVectorLiteral(embedded.vectors[0]);

  // The filter is applied to *both* legs. Forgetting it on the keyword leg is
  // the quiet way a persona ends up citing a book it was never granted.
  //
  // `sql.join` expands the keys into one placeholder each rather than binding
  // the array as a single parameter — Drizzle passes a JS array through as one
  // value, which Postgres then rejects as a malformed array literal.
  const keyList = sql.join(collectionKeys.map((key) => sql`${key}`), sql`, `);
  const inCollections = sql`exists (
    select 1 from library_collection_documents lcd
    join library_collections lc on lc.id = lcd.collection_id
    where lcd.document_id = d.id and lc.is_active and lc.key in (${keyList})
  )`;

  const [vectorLeg, keywordLeg] = await Promise.all([
    db.execute<Row>(sql`
      select c.id as chunk_id, c.document_id, c.position,
             1 - (v.embedding <=> ${vector}::vector) as score
      from library_chunk_vectors v
      join library_chunks c on c.id = v.chunk_id
      join library_documents d on d.id = c.document_id
      where c.kind = 'body' and d.status = 'ready' and ${inCollections}
        and 1 - (v.embedding <=> ${vector}::vector) >= ${MIN_SIMILARITY}
      order by v.embedding <=> ${vector}::vector
      limit ${CANDIDATES}
    `),
    db.execute<Row>(sql`
      with q as (
        select to_tsquery('english',
          (select string_agg(quote_literal(lexeme), ' | ') from unnest(to_tsvector('english', ${text})))
        ) as query
      )
      select c.id as chunk_id, c.document_id, c.position,
             ts_rank_cd(c.tsv, q.query) as score
      from library_chunks c
      join library_documents d on d.id = c.document_id
      cross join q
      where c.kind = 'body' and d.status = 'ready' and q.query is not null
        and c.tsv @@ q.query and ${inCollections}
      order by score desc
      limit ${CANDIDATES}
    `),
  ]);

  const toHits = (rows: Iterable<Row>): Hit[] =>
    [...rows].map((r) => ({
      chunkId: Number(r.chunk_id),
      documentId: r.document_id,
      position: Number(r.position),
      score: Number(r.score),
    }));

  const fused = [...fuse([toHits(vectorLeg), toHits(keywordLeg)]).values()].sort((a, b) => b.score - a.score);

  const perDocument = new Map<string, number>();
  const chosen: Hit[] = [];
  for (const hit of fused) {
    const used = perDocument.get(hit.documentId) ?? 0;
    if (used >= PER_DOCUMENT) continue;
    perDocument.set(hit.documentId, used + 1);
    chosen.push(hit);
    if (chosen.length >= k) break;
  }
  if (chosen.length === 0) return [];

  // Widen each hit to its neighbours, then let the union collapse overlaps —
  // two adjacent hits become one continuous run rather than the same paragraph
  // twice.
  const wanted = new Set<string>();
  for (const hit of chosen) {
    for (let offset = -expand; offset <= expand; offset++) {
      if (hit.position + offset >= 0) wanted.add(`${hit.documentId}:${hit.position + offset}`);
    }
  }

  const passages = await db.execute<{
    document_id: string;
    position: number;
    text: string;
    page_from: number | null;
    heading: string | null;
    title: string;
    author: string | null;
  }>(sql`
    select c.document_id, c.position, c.text, c.page_from, c.heading, d.title, d.author
    from library_chunks c
    join library_documents d on d.id = c.document_id
    where (c.document_id || ':' || c.position) in (${sql.join([...wanted].map((key) => sql`${key}`), sql`, `)})
    order by c.document_id, c.position
  `);

  const byKey = new Map(
    [...passages].map((row) => [`${row.document_id}:${row.position}`, row]),
  );

  const out: KnowledgeChunk[] = [];
  let budget = maxChars;

  for (const hit of chosen) {
    const parts: string[] = [];
    for (let offset = -expand; offset <= expand; offset++) {
      const row = byKey.get(`${hit.documentId}:${hit.position + offset}`);
      if (row) parts.push(row.text);
    }
    const centre = byKey.get(`${hit.documentId}:${hit.position}`);
    if (!centre || parts.length === 0) continue;

    const body = parts.join('\n\n');
    // Whole passages only. Slicing mid-sentence hands the model a truncated
    // quotation it will then reproduce as if it were complete.
    if (body.length > budget) break;
    budget -= body.length;

    const page = centre.page_from ? `p. ${centre.page_from}` : null;
    out.push({
      title: centre.heading ? `${centre.title} — ${centre.heading}` : centre.title,
      text: body,
      citation: [centre.title, centre.author, page].filter(Boolean).join(', '),
      sourceKey: 'library',
    });
  }

  return out;
}
