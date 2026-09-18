/** Read-only contract test for the fixed legacy source and its SQL parser. */
import { readFile } from 'node:fs/promises';
import {
  LEGACY_PROMPT_COLUMNS,
  legacyCapabilities,
  legacyNumber,
  legacyString,
  legacySuggestions,
  parseLegacyPromptDump,
} from '../src/lib/persona/legacy-source';

const sourcePath = process.argv.find((value) => value.startsWith('--source='))?.slice('--source='.length)
  ?? '/var/www/freelee.cv/personattest.json';

function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
  process.stdout.write(`PASS: ${label}\n`);
}

const source = await readFile(sourcePath, 'utf8');
const parsed = parseLegacyPromptDump(source);
const active = parsed.characters.filter((row) => legacyNumber(row, 'status') === 1);
const inactive = parsed.characters.filter((row) => legacyNumber(row, 'status') === 0);

check('the schema has exactly 49 legacy columns', LEGACY_PROMPT_COLUMNS.length === 49);
check('all six INSERT blocks were found', parsed.insertBlocks === 6);
check('all 126 source tuples were parsed', parsed.rows.length === 126);
check('target-level deduplication produces 122 characters', parsed.characters.length === 122);
check('four duplicate character groups were merged', parsed.duplicateGroups.length === 4);
check('each duplicate group contains exactly two source rows', parsed.duplicateGroups.every((group) => group.refs.length === 2));
check('87 characters retain active status', active.length === 87);
check('35 characters retain hidden status', inactive.length === 35);
check('every character has a name, slug and prompt', parsed.characters.every((row) => (
  legacyString(row, 'name').length > 0
  && legacyString(row, 'slug').length > 0
  && legacyString(row, 'prompt').length > 0
)));
check('every source suggestions value is valid JSON string[]', parsed.rows.every((row) => {
  legacySuggestions(row);
  return true;
}));
check('all target slugs are unique', new Set(parsed.characters.map((row) => legacyString(row, 'slug'))).size === 122);
check('capability mapping exposes all twelve supported flags', Object.keys(legacyCapabilities(parsed.characters[0])).length === 12);
check('source checksum is a SHA-256 digest', /^[a-f0-9]{64}$/.test(parsed.sourceSha256));

process.stdout.write('Legacy persona source verification complete.\n');
