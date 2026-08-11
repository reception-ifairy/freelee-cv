/**
 * Asserts that every commit on `main` has an entry in `docs/CHANGELOG.md`.
 *
 * The changelog exists because "keep a record of every update" is a standing
 * instruction, and a standing instruction kept by hand is one that quietly
 * lapses. This turns it into something that fails loudly instead — run it
 * before pushing and a missing entry is caught while the reasoning is still in
 * your head, not six commits later when nobody remembers why.
 *
 *   npx tsx scripts/verify-changelog.ts
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CHANGELOG = 'docs/CHANGELOG.md';

/**
 * Commits made before the changelog existed are still expected to be in it —
 * the first version was backfilled from the full history, so there is no
 * "start from here" cutoff to maintain. If that ever changes, it belongs here
 * as an explicit constant rather than as a silently skipped range.
 */
const EXEMPT = new Set<string>([]);

/**
 * Matched on the **subject line, not the hash**.
 *
 * A hash does not exist until the commit is made, so a hash-based check could
 * never be satisfied by the commit that introduces the entry — you would always
 * be one commit behind, which is exactly the drift this is meant to prevent.
 * The subject is known while you are writing the entry, so the entry and the
 * change it describes land together.
 *
 * Hashes still appear in the changelog, added once known. They are useful to a
 * reader and are deliberately not what this check depends on.
 */
function main() {
  const log = execFileSync('git', ['log', '--pretty=format:%h|%s'], { encoding: 'utf8' }).trim();
  if (!log) {
    console.log('No commits yet — nothing to check.');
    return;
  }

  const changelog = readFileSync(CHANGELOG, 'utf8');
  const commits = log.split('\n').map((line) => {
    const [hash, ...rest] = line.split('|');
    return { hash, subject: rest.join('|') };
  });

  const missing = commits.filter((c) => !EXEMPT.has(c.hash) && !changelog.includes(c.subject));

  console.log(`\nChangelog coverage\n`);
  console.log(`  ${commits.length - missing.length}/${commits.length} commits recorded in ${CHANGELOG}`);

  if (missing.length > 0) {
    console.log('\n  Missing an entry:');
    for (const c of missing) console.log(`    ✗ ${c.hash}  ${c.subject}`);
    console.log(
      '\n  Add each one to the top of the changelog under its date, with what changed and why,\n' +
        '  plus the doc it belongs to and the migration if it touched the database.\n',
    );
    process.exit(1);
  }

  console.log('\n  ✓ every commit is recorded\n');
}

main();
