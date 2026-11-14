/**
 * Checks the subject-dictionary rules (src/lib/curriculum/subjects.ts) on a
 * small dictionary shaped like the curriculum's GET /v1/subjects after Fetch:
 * synonyms, parts stored as subjects, overlapping subjects, years, the
 * fallback before the first Fetch, and the profile schema built from it.
 * No network, no database.
 *
 *   npx tsx scripts/verify-curriculum-subjects.ts
 */
import {
  FALLBACK_SUBJECTS, canonicalSubject, displayLabel, hasParts, offeredIn, rootSubject, sameFamily, subjectLabel, subjectOptions, subjectsForYear,
  type SubjectsDictionary,
} from '../src/lib/curriculum/subjects';
import { readSubjectsCache } from '../src/lib/curriculum/stored';

const dict: SubjectsDictionary = {
  version: '2026-11-14', hash: 'test', fetchedAt: '2026-11-14T00:00:00Z',
  options: [
    { id: 'mathematics', label: 'Maths' },
    { id: 'english', label: 'English' },
    { id: 'english literature', label: 'English literature', partOf: 'english', from: 'Y9', to: 'Y11' },
    { id: 'science', label: 'Science' },
    { id: 'biology', label: 'Biology', partOf: 'science' },
    { id: 'chemistry', label: 'Chemistry', partOf: 'science' },
    { id: 'languages', label: 'Languages' },
    { id: 'french', label: 'French', partOf: 'languages' },
    { id: 'religious education', label: 'RE', to: 'Y8' },
    { id: 'pshe', label: 'PSHE', childSelectable: false, sensitive: true },
  ],
  aliases: { maths: 'mathematics', 'combined science': 'science', sciences: 'science' },
  parts: { 'english reading': 'english', 'english grammar, punctuation and spelling': 'english', phonics: 'english' },
};

let failed = 0;
function check(name: string, fn: () => boolean) {
  try {
    if (!fn()) throw new Error('returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log('Subject dictionary rules');
check('synonyms, courses and parts resolve to a subject; unknown names stay', () =>
  canonicalSubject(' Maths ', dict) === 'mathematics' && canonicalSubject('combined science', dict) === 'science'
  && canonicalSubject('english reading', dict) === 'english' && canonicalSubject('underwater basket weaving', dict) === 'underwater basket weaving');
check('without a dictionary a name is only normalised', () => canonicalSubject(' Maths ', null) === 'maths');
check('parts lead to their whole subject', () => rootSubject('biology', dict.options) === 'science' && rootSubject('science', dict.options) === 'science');
check('a science tutor teaches the child who chose biology, and the reverse', () => sameFamily('science', 'biology', dict) && sameFamily('biology', 'science', dict));
check('biology and chemistry are one family (both science), maths and English are not', () => sameFamily('biology', 'chemistry', dict) && !sameFamily('mathematics', 'english', dict));
check('an "english reading" tutor (STA papers) teaches English', () => sameFamily('english reading', 'english', dict) && sameFamily('english grammar, punctuation and spelling', 'english literature', dict));
check('years: English literature from Year 9, RE to Year 8', () =>
  !offeredIn(dict.options[2], 'Y4') && offeredIn(dict.options[2], 'Y10') && offeredIn(dict.options[8], 'Y8') && !offeredIn(dict.options[8], 'Y9'));
check('a parent never ticks PSHE (it has its own consent)', () => !subjectsForYear(dict.options, 'Y5').some((o) => o.id === 'pshe'));
check('Year 4 offers biology and French but not English literature', () => {
  const ids = subjectsForYear(dict.options, 'Y4').map((o) => o.id);
  return ids.includes('biology') && ids.includes('french') && !ids.includes('english literature');
});
check('labels: a part says what it belongs to', () => displayLabel(dict.options[4], dict.options) === 'Biology · part of Science' && displayLabel(dict.options[0], dict.options) === 'Maths');
check('labels fall back to the built-in list, then to the id', () => subjectLabel('art and design') === 'Art & design' && subjectLabel('latin', dict.options) === 'latin');
check('before the first Fetch the sixteen built-in subjects stand in, with no parts', () =>
  subjectOptions(null) === FALLBACK_SUBJECTS && FALLBACK_SUBJECTS.length === 16 && !hasParts(FALLBACK_SUBJECTS) && hasParts(dict.options));
check('the Fetch cache parses, and a broken one is null (the fallback then applies)', () =>
  readSubjectsCache(JSON.parse(JSON.stringify(dict)))?.options.length === 10 && readSubjectsCache({ version: 'x', options: [] }) === null);

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll subject-dictionary checks passed.');
