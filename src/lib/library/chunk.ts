/**
 * Cutting a cleaned book into the passages a bot will actually read.
 *
 * Not `server-only` — scripts/verify-library-chunking.ts imports it, the same
 * reason src/lib/documents/extract.ts is not marked either.
 *
 * Two decisions carry the design:
 *
 * **Small passages, no overlap.** The instinct is large overlapping windows so
 * no idea is ever cut in half. But overlap costs ~15% more embedding for text
 * you already have, and it fills the result list with near-duplicates that then
 * crowd out genuinely different material. Instead every passage keeps its
 * `position`, and retrieval stitches each hit back together with its
 * neighbours at read time (src/lib/library/search.ts). Precision at search
 * time, context at answer time, and the corpus is a clean partition — which is
 * also what makes the reassembly property test possible.
 *
 * **Paragraphs, not characters.** Splitting at a fixed offset cuts sentences in
 * half and produces passages that read like nonsense in the panel's passage
 * viewer — which is the screen where a non-expert judges whether any of this
 * worked. A passage that starts and ends on a paragraph boundary can be read.
 */

import type { ChunkKind, CleanedPage } from './clean';

/**
 * ~275 tokens at roughly four characters per token. There is no tokenizer in
 * this project's dependencies and adding one for a sizing heuristic would be
 * a poor trade — but that is exactly why `charCount`, not `tokens`, is the
 * column name: an estimate should not be dressed up as a measurement.
 *
 * **This number is a price.** Three passages reach the model on every grounded
 * turn and `costForTokens` bills them as input like anything else, so passage
 * size lands directly on the customer's credit balance. Measured against real
 * traffic on this site (average message: 411 tokens in, 87 out), a plain reply
 * on Haiku costs 2 credits; at 1,800 characters a grounded one cost 10, and at
 * 1,100 it costs 5. That was a deliberate trade of some context for half the
 * price, taken with the numbers in hand. See docs/48-knowledgebase.md.
 */
export const TARGET_CHARS = 1100;
/** A passage may run over target to finish a paragraph, but never past this. */
export const MAX_CHARS = 1600;
/** Below this a fragment is merged forward rather than emitted on its own. */
export const MIN_CHARS = 300;

export type Passage = {
  position: number;
  pageFrom: number;
  pageTo: number;
  heading: string | null;
  kind: ChunkKind;
  text: string;
  charCount: number;
};

type Block = { text: string; page: number; kind: ChunkKind; heading: string | null };

const SENTENCE_END = /[.!?"')\]]$/;

/**
 * A line that is probably a heading: short, not punctuated like a sentence,
 * and either numbered, capitalised throughout, or in title case. Used only to
 * label a passage — a wrong guess costs a slightly odd label in the panel,
 * never a lost or misplaced word.
 */
function headingOf(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return null;
  if (/[.,;:]$/.test(trimmed)) return null;
  const numbered = /^([0-9]+|[IVXLC]+)[.)]?\s+\S/.test(trimmed);
  const shouty = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const titled = /^[A-Z][a-z]/.test(trimmed) && trimmed.split(/\s+/).length <= 8;
  return numbered || shouty || titled ? trimmed : null;
}

/** Split a page into paragraphs, tracking the most recent heading seen. */
function blocksOfPage(page: CleanedPage, carriedHeading: string | null): { blocks: Block[]; heading: string | null } {
  const blocks: Block[] = [];
  let heading = carriedHeading;

  for (const raw of page.text.split(/\n{2,}/)) {
    const para = raw.trim();
    if (!para) continue;

    // A single short line on its own is a heading, not a paragraph — record it
    // and keep it in the text, since a passage that names its section is more
    // useful to the model than one that does not.
    if (!para.includes('\n')) {
      const maybe = headingOf(para);
      if (maybe) heading = maybe;
    }
    blocks.push({ text: para.replace(/\n/g, ' ').trim(), page: page.number, kind: page.kind, heading });
  }
  return { blocks, heading };
}

/**
 * Join the last paragraph of one page to the first of the next when the page
 * break clearly fell mid-sentence. Without this every page boundary in the
 * book produces one truncated passage and one that starts mid-clause.
 */
function healPageBreaks(blocks: Block[]): Block[] {
  const healed: Block[] = [];
  for (const block of blocks) {
    const prev = healed[healed.length - 1];
    const continues =
      prev &&
      prev.page !== block.page &&
      prev.kind === block.kind &&
      !SENTENCE_END.test(prev.text) &&
      /^[a-z(]/.test(block.text);
    if (continues) {
      prev.text = `${prev.text} ${block.text}`;
      continue;
    }
    healed.push({ ...block });
  }
  return healed;
}

/**
 * Break a paragraph that is on its own too long. Sentence boundaries first;
 * a single sentence past the limit (a table dumped as one line, a URL soup) is
 * hard-sliced, because refusing to split it would put an unbounded string into
 * one embedding call.
 */
function splitLongBlock(text: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (current && current.length + sentence.length + 1 > MAX_CHARS) {
      out.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
    while (current.length > MAX_CHARS) {
      out.push(current.slice(0, MAX_CHARS));
      current = current.slice(MAX_CHARS);
    }
  }
  if (current) out.push(current);
  return out;
}

/** Cut a cleaned document into passages. Pure, deterministic, total. */
export function chunkPages(pages: CleanedPage[]): Passage[] {
  let heading: string | null = null;
  const raw: Block[] = [];
  for (const page of pages) {
    const result = blocksOfPage(page, heading);
    heading = result.heading;
    raw.push(...result.blocks);
  }

  const blocks: Block[] = [];
  for (const block of healPageBreaks(raw)) {
    if (block.text.length <= MAX_CHARS) {
      blocks.push(block);
      continue;
    }
    for (const part of splitLongBlock(block.text)) blocks.push({ ...block, text: part });
  }

  const passages: Passage[] = [];
  let buffer: Block[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.map((b) => b.text).join('\n\n');
    passages.push({
      position: passages.length,
      pageFrom: buffer[0].page,
      pageTo: buffer[buffer.length - 1].page,
      heading: buffer[0].heading,
      kind: buffer[0].kind,
      text,
      charCount: text.length,
    });
    buffer = [];
  };

  for (const block of blocks) {
    const size = buffer.reduce((n, b) => n + b.text.length + 2, 0);
    // A passage never mixes body text with back matter: they are retrieved
    // under different rules, so one passage cannot be both.
    if (buffer.length > 0 && (buffer[0].kind !== block.kind || size + block.text.length > TARGET_CHARS)) {
      // Unless the buffer is still tiny, in which case emitting it would put a
      // two-line orphan into the index.
      if (size >= MIN_CHARS || buffer[0].kind !== block.kind) flush();
    }
    buffer.push(block);
    if (buffer.reduce((n, b) => n + b.text.length + 2, 0) >= MAX_CHARS) flush();
  }
  flush();

  return passages;
}
