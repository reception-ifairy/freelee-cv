/**
 * Every status in one place, said in plain language.
 *
 * The whole section exists so that somebody who has never embedded anything
 * can tell what happened. `needs_ocr` means nothing to that person; "this is a
 * scan, the pages are pictures" does. So the enum value is never rendered —
 * this map is.
 */
export const STATUS_COPY: Record<string, { label: string; hint: string; tone: 'brand' | 'green' | 'amber' | 'rose' | 'slate' }> = {
  pending: {
    label: 'Not processed yet',
    hint: 'Found in the folder. Nothing has been read or sent anywhere — press Process when you want it in the knowledgebase.',
    tone: 'slate',
  },
  processing: {
    label: 'Working…',
    hint: 'Being read, split into passages and turned into searchable numbers. This page refreshes on its own.',
    tone: 'brand',
  },
  ready: {
    label: 'Ready',
    hint: 'A bot granted this shelf can quote from it, with the page number.',
    tone: 'green',
  },
  needs_ocr: {
    label: 'Needs OCR',
    hint: 'This is a scan — the pages are pictures of text, with no text in them. Reading it needs OCR, which is not built yet.',
    tone: 'amber',
  },
  failed: {
    label: 'Could not read it',
    hint: 'Something went wrong. The reason is shown on the document’s own page.',
    tone: 'rose',
  },
  missing: {
    label: 'File is gone',
    hint: 'The file is no longer in the folder. What it taught the bots is kept — delete it here if that was deliberate.',
    tone: 'rose',
  },
};

export function statusCopy(status: string) {
  return STATUS_COPY[status] ?? { label: status, hint: '', tone: 'slate' as const };
}

/** Bytes as something a person reads, not a number with nine digits. */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * What the ingest actually cost, in money rather than tokens.
 *
 * $0.02 per million tokens for text-embedding-3-small. Shown because "3,551
 * tokens" answers no question anybody has, and because the honest headline of
 * this whole feature is that indexing a library is a rounding error — it is
 * the *asking* that costs.
 */
export function embedCost(tokens: number): string {
  const dollars = (tokens / 1_000_000) * 0.02;
  if (tokens === 0) return '—';
  if (dollars < 0.01) return 'under $0.01';
  return `$${dollars.toFixed(2)}`;
}
