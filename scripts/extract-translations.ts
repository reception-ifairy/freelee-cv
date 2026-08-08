/**
 * Builds the modular "word bank" — every `t(key, fallback)` call site's
 * English source string, grouped into one JSON file per namespace
 * (`i18n/home.en.json`, `i18n/blog.en.json`, …). English is never stored in
 * the `translations` table (see the schema comment on that table): these bank
 * files *are* the English source of truth, and the translation pipeline reads
 * them module by module to produce the non-English rows.
 *
 *   npm run i18n:extract
 *
 * **Scans the whole `src/` tree**, not a hand-maintained file list. The
 * previous version registered files explicitly and silently went stale the
 * moment the home page was refactored into `src/components/site/sections/*`
 * — the registered path kept existing, so nothing errored, it just stopped
 * finding 20-odd keys. A directory walk can't rot that way.
 *
 * The old objection to a blind scan (an unrelated `t()` identifier getting
 * picked up) is handled structurally instead: a call only counts if its key
 * is `<known-namespace>.<name>`. Nothing else in this codebase calls a
 * one-letter function with a dotted, namespace-prefixed string literal.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_NAMESPACES, bankPath, isNamespace, namespaceOfKey } from '../src/lib/i18n/namespaces';
import type { Namespace } from '../src/lib/i18n/namespaces';

const SCAN_ROOT = 'src';
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Matches t('some.key', 'English fallback' …) — single-quoted key/fallback;
// the fallback may contain escaped quotes (\') but not raw ones.
const T_CALL_RE = /\bt\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;

/**
 * Comments are stripped before matching. Without this, a doc comment that
 * *describes* the pattern — e.g. "lives here as literal `t('help.…',
 * 'English')`" in src/lib/help/topics.ts — is scanned as if it were a real
 * call site and lands a junk key in the bank, which then gets sent to the
 * translator. Caught exactly that way on the first full extraction.
 *
 * Deliberately naive (no string-literal awareness): a `//` or `/* *\/`
 * sequence inside a string would be over-stripped, but the only cost is
 * missing a key, and no `t()` fallback in this codebase contains one.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  const banks = new Map<Namespace, Map<string, string>>();
  for (const ns of ALL_NAMESPACES) banks.set(ns, new Map());

  let fileCount = 0;
  let callCount = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for await (const file of walk(SCAN_ROOT)) {
    const content = stripComments(await readFile(file, 'utf8'));
    let matchedHere = false;

    for (const match of content.matchAll(T_CALL_RE)) {
      const [, key, rawFallback] = match;

      // The structural guard: only namespace-prefixed keys count, so an
      // unrelated `t(...)` in third-party-shaped code can never leak in.
      if (!isNamespace(key.split('.')[0])) {
        skipped += 1;
        continue;
      }

      const fallback = rawFallback.replace(/\\'/g, "'");
      const bank = banks.get(namespaceOfKey(key))!;
      callCount += 1;
      matchedHere = true;

      const existing = bank.get(key);
      if (existing !== undefined && existing !== fallback) {
        conflicts.push(`  "${key}"\n    kept:    ${existing}\n    ignored: ${fallback}  (${file})`);
        continue;
      }
      bank.set(key, fallback);
    }

    if (matchedHere) fileCount += 1;
  }

  await mkdir('i18n', { recursive: true });
  let total = 0;

  for (const ns of ALL_NAMESPACES) {
    const bank = banks.get(ns)!;
    const sorted = Object.fromEntries([...bank.entries()].sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(bankPath(ns), `${JSON.stringify(sorted, null, 2)}\n`);
    total += bank.size;
    console.log(`  ${bankPath(ns).padEnd(28)} ${String(bank.size).padStart(4)} key(s)`);
  }

  console.log(`\nScanned ${SCAN_ROOT}/ — ${callCount} t() call(s) across ${fileCount} file(s), ${total} unique key(s).`);
  if (skipped > 0) console.log(`Skipped ${skipped} t() call(s) with a non-namespaced key.`);
  if (conflicts.length > 0) {
    console.warn(`\n⚠ ${conflicts.length} conflicting fallback(s) — first seen kept:\n${conflicts.join('\n')}`);
  }
}

main().catch((error) => {
  console.error('Extraction failed:', error);
  process.exit(1);
});
