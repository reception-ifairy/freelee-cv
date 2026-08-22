import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Page } from './clean';

const run = promisify(execFile);

/**
 * PDF text, via poppler.
 *
 * `src/lib/documents/extract.ts` deliberately does not parse PDFs — its header
 * says extracting their text properly means font encodings, CMaps and content
 * stream operators, "which *is* a library's job". That judgement stands; this
 * file does not disagree with it, it just uses a library that is already
 * installed on the box rather than adding a JavaScript one. poppler-utils 24.02
 * ships with Ubuntu and is the same engine every desktop PDF viewer uses.
 *
 * Not `server-only`, for the same reason src/lib/documents/extract.ts is not:
 * the CLI backfill and the spike script run outside Next entirely, where that
 * import throws. There is nothing to protect here anyway — no secrets, no
 * database, and the path has already been validated by
 * src/lib/library/paths.ts, which *is* server-only.
 *
 * Every call here is `execFile`, never a shell string: `source_path` comes from
 * a directory the operator drops files into, and a filename is not a place to
 * find out that a shell was involved.
 */

/** A book's text runs to several megabytes; the default 1 MB buffer truncates silently. */
const MAX_BUFFER = 64 * 1024 * 1024;
/** Malformed PDFs make poppler spin. Bounded so the job fails rather than hangs. */
const TIMEOUT_MS = 180_000;

export type PdfMetadata = {
  pages: number;
  title: string | null;
  author: string | null;
  year: number | null;
};

export type PdfExtraction =
  | { ok: true; pages: Page[]; metadata: PdfMetadata }
  | { ok: false; reason: 'no_text_layer' | 'unreadable'; detail: string; metadata: PdfMetadata | null };

function parseInfo(stdout: string): PdfMetadata {
  const field = (name: string): string | null => {
    const match = stdout.split('\n').find((line) => line.startsWith(`${name}:`));
    const value = match?.slice(name.length + 1).trim();
    return value || null;
  };
  const dateField = field('CreationDate') ?? field('ModDate') ?? '';
  const year = /\b(1[5-9][0-9]{2}|20[0-9]{2})\b/.exec(dateField)?.[1];
  return {
    pages: Number(field('Pages') ?? 0) || 0,
    title: field('Title'),
    author: field('Author'),
    year: year ? Number(year) : null,
  };
}

export async function pdfMetadata(absPath: string): Promise<PdfMetadata | null> {
  try {
    const { stdout } = await run('pdfinfo', [absPath], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER });
    return parseInfo(stdout);
  } catch {
    return null;
  }
}

/**
 * Whether the file has a text layer at all.
 *
 * `pdffonts` listing no embedded fonts means the pages are images — a scan.
 * That is a definitive answer where "few characters per page" is a guess, and
 * the difference matters: a 400-page book with twenty scanned plates should be
 * ingested, not refused.
 */
export async function hasTextLayer(absPath: string): Promise<boolean> {
  try {
    const { stdout } = await run('pdffonts', [absPath], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER });
    // Two header lines and a rule, then one line per font.
    return stdout.split('\n').filter((line) => line.trim().length > 0).length > 2;
  } catch {
    return false;
  }
}

/**
 * Extract the text, one entry per page.
 *
 * **Not `-layout`**, which is the flag everyone reaches for first and is wrong
 * for prose. `-layout` preserves the *physical* arrangement, so a two-column
 * page comes out as "fragment of column one … gutter … fragment of column two"
 * on a single line — interleaved half-sentences from two unrelated columns, on
 * every journal PDF there is. Poppler's default mode runs reading-order
 * detection instead and emits column one, then column two. `-layout` is for
 * tables.
 *
 * `-nopgbrk` is likewise *not* passed: the form feed poppler puts between pages
 * is the only thing that makes a citation able to say which page it came from.
 */
export async function extractPdf(absPath: string): Promise<PdfExtraction> {
  const metadata = await pdfMetadata(absPath);
  if (!metadata) {
    return { ok: false, reason: 'unreadable', detail: 'pdfinfo could not read this file.', metadata: null };
  }

  if (!(await hasTextLayer(absPath))) {
    return {
      ok: false,
      reason: 'no_text_layer',
      detail: 'This PDF is a scan — the pages are images with no text in them. It needs OCR before it can be read.',
      metadata,
    };
  }

  let stdout: string;
  try {
    ({ stdout } = await run('pdftotext', ['-enc', 'UTF-8', '-eol', 'unix', '-q', absPath, '-'], {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    }));
  } catch (error) {
    return {
      ok: false,
      reason: 'unreadable',
      detail: error instanceof Error ? error.message : 'pdftotext failed.',
      metadata,
    };
  }

  const pages: Page[] = stdout
    .split('\f')
    .map((text, index) => ({ number: index + 1, text }))
    // The form feed after the final page leaves one empty trailing entry.
    .filter((page, index, all) => !(index === all.length - 1 && page.text.trim() === ''));

  const characters = pages.reduce((n, page) => n + page.text.trim().length, 0);
  if (characters === 0) {
    return {
      ok: false,
      reason: 'no_text_layer',
      detail: 'The file has fonts but produced no text. It may be an image-only scan with a font stub.',
      metadata,
    };
  }

  return { ok: true, pages, metadata };
}
