import { inflateRawSync } from 'node:zlib';

/**
 * Pulls readable text out of an uploaded document.
 *
 * **Not marked `server-only`**, for the same reason `lib/rate-limit.ts` isn't:
 * the guard would buy nothing and would stop `scripts/verify-document-extract.ts`
 * from testing this. It imports `node:zlib` and takes a `Buffer`, so a client
 * component that pulled it in would fail at bundle time regardless.
 *
 * **Zero dependencies, deliberately.** `.docx` and `.xlsx` are ZIP archives of
 * XML, and Node already ships the only hard part (`inflateRawSync`), so the
 * whole reader below is ~120 lines. Adding a parsing library to this app would
 * mean auditing and updating it forever for two file formats a handful of
 * admins will use a handful of times.
 *
 * PDFs are the exception: extracting their text properly means font encodings,
 * CMaps and content-stream operators, which *is* a library's job. So a PDF is
 * not parsed here at all — it is handed to the model as a file attachment,
 * which the modern OpenAI/Anthropic/Google models read natively and far better
 * than a naive text scrape would. `extractDocument()` says which of the two
 * happened, and the caller builds its prompt accordingly.
 */

/** What the model is given: either extracted text, or the raw file to read itself. */
export type ExtractedDocument =
  | { mode: 'text'; text: string; truncated: boolean }
  | { mode: 'file'; base64: string; mediaType: string };

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.pdf', '.docx', '.xlsx'] as const;

/** 8 MB. Large enough for a scanned brand book, small enough not to be a memory attack. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Cap on what reaches the model. A 400-page PDF converted to text would cost
 * more per conversion than the persona is worth, and the character brief we
 * are looking for is always near the front.
 */
const MAX_TEXT_CHARS = 120_000;

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function isSupportedDocument(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/* ------------------------------ ZIP reading ------------------------------ */

type ZipEntry = { name: string; offset: number; method: number; compressedSize: number };

/**
 * Walks a ZIP's central directory.
 *
 * The central directory is read rather than scanning for local file headers,
 * because an entry written with a streaming data descriptor carries zeroes for
 * its sizes in the local header — the real values only exist here.
 */
function readZipEntries(buffer: Buffer): ZipEntry[] {
  // The end-of-central-directory record sits within 64KB of the end (the
  // trailing comment is a uint16 length), so scan backwards from there only.
  const scanFrom = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= scanFrom; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Not a readable Office file — the ZIP directory is missing.');

  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  if (cursor === 0xffffffff) throw new Error('ZIP64 archives are not supported.');

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    entries.push({
      name: buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength),
      method: buffer.readUInt16LE(cursor + 10),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      offset: buffer.readUInt32LE(cursor + 42),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipFile(buffer: Buffer, entry: ZipEntry): string {
  // The local header repeats the filename and may carry a *different* extra
  // field length from the central directory, so both are re-read here rather
  // than reused — getting this wrong offsets the data by a few bytes and the
  // inflate fails with a confusing error.
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw.toString('utf8');
  if (entry.method === 8) return inflateRawSync(raw).toString('utf8');
  throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
}

/* ------------------------------ XML to text ------------------------------ */

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Strips tags, keeping the paragraph and tab breaks that carry the document's shape. */
function xmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

function extractDocx(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const document = entries.find((e) => e.name === 'word/document.xml');
  if (!document) throw new Error('That .docx has no document body.');
  return xmlToText(readZipFile(buffer, document)).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Flattens a workbook to tab-separated rows.
 *
 * Row and column structure is kept rather than dumping the shared-string table,
 * because a legacy bot config sheet is almost always a key/value grid — and
 * "tone | warm and direct" tells the model far more than the two words loose.
 */
function extractXlsx(buffer: Buffer): string {
  const entries = readZipEntries(buffer);

  const sharedEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedEntry) {
    const xml = readZipFile(buffer, sharedEntry);
    for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeEntities(match[1].replace(/<[^>]+>/g, '')));
    }
  }

  const sheets = entries
    .filter((e) => /^xl\/worksheets\/sheet\d*\.xml$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

  const out: string[] = [];
  for (const sheet of sheets) {
    const xml = readZipFile(buffer, sheet);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const isShared = /\bt="s"/.test(cell[1]);
        const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
        const inline = cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        cells.push(
          isShared ? (shared[Number(value)] ?? '') : decodeEntities(inline ?? value),
        );
      }
      if (cells.some((c) => c.trim())) out.push(cells.join('\t'));
    }
  }
  return out.join('\n').trim();
}

/* -------------------------------- Entry point -------------------------------- */

export async function extractDocument(filename: string, bytes: Buffer): Promise<ExtractedDocument> {
  const extension = extensionOf(filename);

  if (extension === '.pdf') {
    return { mode: 'file', base64: bytes.toString('base64'), mediaType: 'application/pdf' };
  }

  let text: string;
  if (extension === '.docx') text = extractDocx(bytes);
  else if (extension === '.xlsx') text = extractXlsx(bytes);
  else if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)) text = bytes.toString('utf8');
  else throw new Error(`${extension || 'That file type'} is not supported.`);

  if (!text.trim()) {
    throw new Error('No readable text was found in that file — it may be an image-only scan.');
  }

  return text.length > MAX_TEXT_CHARS
    ? { mode: 'text', text: text.slice(0, MAX_TEXT_CHARS), truncated: true }
    : { mode: 'text', text, truncated: false };
}
