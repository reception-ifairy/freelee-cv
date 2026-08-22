import 'server-only';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Where the library lives on disk, and the only place a path from the outside
 * world is turned into a real one.
 *
 * Deliberately not the media store (src/lib/media/store.ts): it cannot hold a
 * PDF — `OBJECT_NAME_RE` allows five image extensions and `mp3`, and both the
 * writer and the `/uploads/[name]` reader enforce it — and teaching it to
 * would mean loosening the validation that keeps chat uploads safe. Books are
 * also far larger than anything that store was sized for, and they belong on
 * the mounted volume rather than beside the app.
 *
 * The root is configurable because a dev box has no 100 GB volume attached.
 */
export const LIBRARY_ROOT = process.env.LIBRARY_ROOT || '/mnt/HC_Volume_104760667/freelee-library';

/** Extensions the scanner will pick up. PDFs are the point; the rest are cheap to support. */
export const LIBRARY_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

export function isLibraryFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return (LIBRARY_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Resolve a stored `source_path` (always relative to the root) to an absolute
 * path, refusing anything that escapes.
 *
 * Two checks, not one, because they catch different attacks. `path.resolve`
 * plus a prefix test stops `../../etc/passwd` — but not a **symlink** inside
 * the library pointing out of it, which resolves cleanly and then reads
 * whatever it likes. `fs.realpath` is what closes that, and it is why this
 * function is async when it looks like it should not be.
 *
 * The separator matters in the prefix test: without it, a sibling directory
 * named `freelee-library-old` would pass `startsWith(root)`.
 */
export async function resolveLibraryPath(relativePath: string): Promise<string | null> {
  if (!relativePath || relativePath.includes('\0')) return null;

  const root = path.resolve(LIBRARY_ROOT);
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;

  try {
    const real = await fs.realpath(candidate);
    const realRoot = await fs.realpath(root);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null;
    return real;
  } catch {
    // Does not exist yet — the prefix check above already passed, so this is a
    // legitimate destination for a new upload rather than a traversal attempt.
    return candidate;
  }
}

/**
 * The collection a file belongs to, from its first path segment.
 *
 * A folder *is* a collection. That is what makes 500 books manageable: nobody
 * is going to tick 500 checkboxes, and every alternative (a rule engine, a
 * filename convention, an LLM classifier) is more machinery than dragging a
 * file into the right folder. Files at the root belong to no collection and
 * are visible only to a persona granted every collection.
 */
export function collectionKeyFor(relativePath: string): string | null {
  const [first, ...rest] = relativePath.split(path.sep).filter(Boolean);
  if (rest.length === 0) return null; // a file sitting directly in the root
  return first.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null;
}
