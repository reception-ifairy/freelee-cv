/**
 * Asserts that every commit on `main` has a correctly numbered entry in
 * `docs/CHANGELOG.md`.
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
 * Every entry carries a **sequence number** — `#1` is the initial commit and
 * `#N` is HEAD — because a seven-character hash is unreadable and unorderable
 * by eye. "What changed in #37" is a question a person can hold; "what changed
 * in a4f361d" is not, and neither hash tells you which came first.
 *
 * The number is a commit's position in `git log --reverse`, so it is derived
 * rather than maintained, and it stays stable as long as history is only ever
 * appended to. Rewriting pushed history (a rebase, an amend of something
 * already on the remote) would renumber everything after the rewrite — which is
 * one more good reason not to.
 *
 * Hashes stay alongside the numbers, since they are what `git show` wants.
 */
type Commit = { number: number; hash: string; subject: string };

function history(): Commit[] {
  const log = execFileSync('git', ['log', '--reverse', '--pretty=format:%h|%s'], { encoding: 'utf8' }).trim();
  if (!log) return [];
  return log.split('\n').map((line, index) => {
    const [hash, ...rest] = line.split('|');
    return { number: index + 1, hash, subject: rest.join('|') };
  });
}

function main() {
  const commits = history();
  if (commits.length === 0) {
    console.log('No commits yet — nothing to check.');
    return;
  }

  const changelog = readFileSync(CHANGELOG, 'utf8');

  // Matched on the **subject line**, not the hash. A hash does not exist until
  // the commit is made, so a hash-based check could never be satisfied by the
  // commit that introduces its own entry — you would always be exactly one
  // behind, which is the drift this is meant to prevent.
  const missing: Commit[] = [];
  const misnumbered: { commit: Commit; found: string }[] = [];
  const stalePending: Commit[] = [];
  const head = commits[commits.length - 1];

  for (const commit of commits) {
    if (EXEMPT.has(commit.hash)) continue;

    // `pending` is allowed in place of the hash, because the entry is written
    // in the same commit as the change and the hash does not exist yet. It is
    // only tolerated on HEAD: anything older with `pending` still on it means
    // somebody never came back to fill it in, so that fails.
    const heading = new RegExp(
      `^### #(\\d+) · \`([0-9a-f]{7}|pending)\` — ${escapeRegExp(commit.subject)}$`,
      'm',
    );
    const match = changelog.match(heading);

    if (!match) {
      missing.push(commit);
      continue;
    }
    if (Number(match[1]) !== commit.number) misnumbered.push({ commit, found: match[1] });
    if (match[2] === 'pending' && commit.hash !== head.hash) stalePending.push(commit);
  }

  console.log('\nChangelog coverage\n');
  console.log(`  ${commits.length - missing.length}/${commits.length} commits recorded in ${CHANGELOG}`);
  console.log(`  HEAD is #${commits[commits.length - 1].number} (${commits[commits.length - 1].hash})`);

  if (missing.length > 0) {
    console.log('\n  Missing an entry:');
    for (const c of missing) console.log(`    ✗ #${c.number}  ${c.hash}  ${c.subject}`);
    console.log(
      '\n  Add each to the top of the changelog under its date, as:\n' +
        '    ### #<number> · `pending` — <exact commit subject>\n' +
        '  (`pending` becomes the real hash on the next update — the check enforces that.)\n' +
        '  followed by what changed and why, the doc it belongs to, and the migration if any.\n',
    );
  }

  if (misnumbered.length > 0) {
    console.log('\n  Wrong sequence number:');
    for (const m of misnumbered) {
      console.log(`    ✗ ${m.commit.hash} is #${m.commit.number}, recorded as #${m.found} — ${m.commit.subject}`);
    }
    console.log('\n  Numbers are positions in `git log --reverse`. If these have all shifted,\n' + '  history was rewritten — check that was intended before renumbering.\n');
  }

  if (stalePending.length > 0) {
    console.log('\n  Hash never filled in:');
    for (const c of stalePending) console.log(`    ✗ #${c.number} is \`pending\`, should be \`${c.hash}\` — ${c.subject}`);
    console.log('\n  `pending` is only allowed on the newest entry. Replace these with the real hash.\n');
  }

  if (missing.length > 0 || misnumbered.length > 0 || stalePending.length > 0) process.exit(1);

  console.log('\n  ✓ every commit is recorded, in order\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
