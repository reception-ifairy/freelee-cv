/**
 * Turning what poppler prints into what is worth embedding.
 *
 * Not `server-only` on purpose — scripts/verify-library-chunking.ts imports
 * it, the same reason src/lib/documents/extract.ts is not marked either.
 *
 * Everything here is a heuristic, and each one exists because of a specific
 * way book PDFs are unlike prose:
 *
 * - a running head repeated on 400 pages becomes 400 near-identical passages
 *   with the journal's name in them, which is exactly the kind of thing vector
 *   search happily matches on;
 * - a bibliography is hundreds of dense entries of pure proper nouns, which
 *   dominates keyword search and burns embedding budget on text no one will
 *   ever ask a question about;
 * - `ﬁ` and `ﬂ` are single codepoints, so an unnormalised "ﬁrst" is a word the
 *   English stemmer has never seen.
 *
 * None of the regexes here nest a quantifier inside a quantifier. That is not
 * style: this runs inside a job whose worker heartbeats on the event loop and
 * reclaims after 90 seconds, so a catastrophic backtrack would not merely be
 * slow — it would get the job run a second time, concurrently.
 */

export type ChunkKind = 'body' | 'frontmatter' | 'backmatter';

export type Page = { number: number; text: string };
export type CleanedPage = Page & { kind: ChunkKind };

/** How much of a window a line must repeat across before it counts as furniture. */
const FURNITURE_RATIO = 0.6;
/** Headers change per chapter, so the comparison window is local, not the whole book. */
const FURNITURE_WINDOW = 20;
/** Only the top and bottom of a page can be a running head or a folio. */
const EDGE_LINES = 2;
/**
 * A running head is short. A sentence is not.
 *
 * Without this cap the detector eats real prose: in a book where many pages
 * end on the same closing sentence — a refrain, a repeated definition, a
 * boilerplate footer paragraph — that sentence is an edge line on most pages
 * of the window and gets stripped as furniture, silently deleting content the
 * reassembly test then reports as lost. Found by exactly that test.
 */
const FURNITURE_MAX_CHARS = 80;

/**
 * Normalise a line for *comparison only*: page numbers and volume numbers
 * differ on every page, so "Journal of X, Vol 12, p. 145" and "…p. 146" have
 * to collapse to the same string or nothing is ever detected as repeated.
 */
function furnitureKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/\b[ivxlcdm]+\b/g, '#')
    .replace(/[^a-z#]+/g, ' ')
    .trim();
}

const HEADING_RE = /^(references|bibliography|works cited|literature cited|notes|index)$/i;

/**
 * NFKC first, then the character-level repairs that survive it.
 *
 * Soft hyphens are invisible and would otherwise sit inside words in both the
 * vector and the tsvector. Non-breaking spaces read as part of a word to the
 * stemmer.
 */
function normaliseText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/­/g, '')
    // Poppler emits U+2010 HYPHEN for a line-break hyphen, not ASCII
    // hyphen-minus, and NFKC does **not** fold it — verified against real
    // poppler output, where every break hyphen in the file was U+2010. Without
    // this line the de-hyphenation below matches nothing at all on a real PDF
    // while passing every synthetic test. U+2013/U+2014 are dashes, not
    // hyphens, and are deliberately left alone.
    .replace(/[\u2010\u2011\u2012\u2212]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\r\n?/g, '\n');
}

/**
 * Join words broken across a line by a hyphen.
 *
 * Restricted to lowercase-hyphen-newline-lowercase, which is the pattern a
 * justified line break produces. It will still occasionally weld a genuine
 * compound ("well-known" → "wellknown") and there is no way to tell the two
 * apart without a dictionary — but line-break hyphens outnumber genuine ones
 * heavily in book text, and a welded compound costs one bad token where an
 * unjoined word costs two.
 */
function dehyphenate(text: string): string {
  return text.replace(/([a-z])-\n([a-z])/g, '$1$2');
}

/**
 * Drop the lines that repeat at the top or bottom of most pages in a window.
 *
 * Only the edges are considered: a sentence that legitimately recurs in body
 * text is not furniture, and stripping it would silently delete content.
 */
function stripFurniture(pages: Page[]): Page[] {
  if (pages.length < 4) return pages;

  const edgeKeys = pages.map((page) => {
    const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
    const edges = [...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)]
      .filter((line) => line.length <= FURNITURE_MAX_CHARS);
    return new Set(edges.map(furnitureKey).filter((k) => k.length > 2));
  });

  return pages.map((page, i) => {
    const from = Math.max(0, i - FURNITURE_WINDOW);
    const to = Math.min(pages.length, i + FURNITURE_WINDOW + 1);
    const window = edgeKeys.slice(from, to);
    const threshold = Math.ceil(window.length * FURNITURE_RATIO);

    const repeated = new Set<string>();
    for (const key of edgeKeys[i]) {
      let seen = 0;
      for (const other of window) if (other.has(key)) seen++;
      if (seen >= threshold) repeated.add(key);
    }
    if (repeated.size === 0) return page;

    const lines = page.text.split('\n');
    const kept = lines.filter((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.length > FURNITURE_MAX_CHARS) return true;
      const isEdge = idx < EDGE_LINES + 1 || idx >= lines.length - (EDGE_LINES + 1);
      return !(isEdge && repeated.has(furnitureKey(trimmed)));
    });
    return { ...page, text: kept.join('\n') };
  });
}

/**
 * Where the body ends and the back matter begins — page *and* line.
 *
 * Only searched in the last 40% of the book, because a chapter called "Notes"
 * near the front is a chapter, and a table of contents lists the word
 * "Bibliography" long before the bibliography starts.
 *
 * The line matters as much as the page. A bibliography does not politely begin
 * on a fresh sheet: it usually starts halfway down the page the last chapter
 * ends on. Splitting by page alone therefore tags the closing paragraphs of
 * the book as back matter and quietly removes them from retrieval — which is
 * exactly what the first spike over a real PDF showed happening.
 */
function backmatterFrom(pages: Page[]): { page: number; line: number } {
  const searchFrom = Math.floor(pages.length * 0.6);
  for (let i = pages.length - 1; i >= searchFrom; i--) {
    const lines = pages[i].text.split('\n');
    const line = lines.findIndex((l) => HEADING_RE.test(l.trim()));
    if (line !== -1) return { page: i, line };
  }
  return { page: pages.length, line: 0 };
}

/**
 * A contents page or an index: most lines end in a page number, usually after
 * dot leaders. Cheap to spot and worthless to embed.
 */
function looksLikeListing(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
  if (lines.length < 6) return false;
  let ending = 0;
  for (const line of lines) if (/[0-9]{1,4}$/.test(line)) ending++;
  return ending / lines.length > 0.5;
}

/** The full pass: normalise, de-hyphenate, strip furniture, classify. */
export function cleanPages(pages: Page[]): CleanedPage[] {
  const normalised = pages.map((page) => ({
    ...page,
    text: dehyphenate(normaliseText(page.text)),
  }));

  const stripped = stripFurniture(normalised);
  const back = backmatterFrom(stripped);
  const frontLimit = Math.ceil(stripped.length * 0.1);

  // Collapse runs of blank lines to exactly one, so paragraph splitting
  // downstream has a single unambiguous separator to work with.
  const tidy = (text: string) => text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const out: CleanedPage[] = [];
  for (const [i, page] of stripped.entries()) {
    if (i > back.page) {
      out.push({ ...page, kind: 'backmatter', text: tidy(page.text) });
      continue;
    }

    // The page the back matter starts on carries both, so it yields two
    // entries with the same page number. Nothing downstream minds: a passage
    // never mixes kinds, and a citation still points at the right page.
    if (i === back.page) {
      const lines = page.text.split('\n');
      const bodyPart = tidy(lines.slice(0, back.line).join('\n'));
      const backPart = tidy(lines.slice(back.line).join('\n'));
      if (bodyPart) out.push({ ...page, kind: 'body', text: bodyPart });
      if (backPart) out.push({ ...page, kind: 'backmatter', text: backPart });
      continue;
    }

    const listing = looksLikeListing(page.text);
    const kind: ChunkKind = listing ? (i < frontLimit ? 'frontmatter' : 'backmatter') : 'body';
    out.push({ ...page, kind, text: tidy(page.text) });
  }
  return out;
}
