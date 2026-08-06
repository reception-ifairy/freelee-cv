/**
 * Builds the "word bank" — every `t(key, fallback)` call site's English
 * source string, collected into one JSON file. This is the deliberate
 * design: English is never stored in the `translations` table (see the
 * schema comment on that table) — the bank file *is* the English source of
 * truth, and `scripts/translate-bank.ts` reads it to produce the non-English
 * rows that actually get inserted.
 *
 *   npx tsx scripts/extract-translations.ts [--namespace=frontend] [--out=i18n/frontend.en.json]
 *
 * Scoped to an explicit file list, not a codebase-wide scan — only the
 * files actually wired up to `getFrontendT()`/`getAdminT()` have real
 * `t()` calls to extract; a blind scan would need to distinguish this
 * project's `t()` from any unrelated same-named identifier. Add a file here
 * the same change you wire it up to translation. See docs/17-translations.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NAMESPACE_FILES: Record<string, string[]> = {
  frontend: [
    'src/components/site/header.tsx',
    'src/components/site/footer.tsx',
    'src/app/(marketing)/page.tsx',
  ],
  admin: [],
};

// Matches t('some.key', 'English fallback' ...) — single-quoted key/fallback;
// the fallback may contain escaped quotes (\') but not raw ones.
const T_CALL_RE = /\bt\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const namespace = arg('namespace') ?? 'frontend';
  const files = NAMESPACE_FILES[namespace];
  if (!files) {
    console.error(`Unknown namespace "${namespace}". Known: ${Object.keys(NAMESPACE_FILES).join(', ')}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.log(`No files registered for namespace "${namespace}" yet — nothing to extract.`);
    return;
  }

  const bank = new Map<string, string>();
  let callCount = 0;

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(T_CALL_RE)) {
      const [, key, rawFallback] = match;
      const fallback = rawFallback.replace(/\\'/g, "'");
      callCount += 1;

      const existing = bank.get(key);
      if (existing !== undefined && existing !== fallback) {
        console.warn(`⚠ Conflicting fallback for key "${key}" — keeping first seen.\n  kept:     ${existing}\n  ignored:  ${fallback} (${file})`);
        continue;
      }
      bank.set(key, fallback);
    }
  }

  const sorted = Object.fromEntries([...bank.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const outPath = arg('out') ?? `i18n/${namespace}.en.json`;
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(sorted, null, 2)}\n`);

  console.log(`Scanned ${files.length} file(s), found ${callCount} t() call(s), ${bank.size} unique key(s).`);
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error('Extraction failed:', error);
  process.exit(1);
});
