/**
 * A chunker is judged by properties, not by looking at its output — the whole
 * point is that it runs unattended over thousands of books nobody will read
 * first. So: it must lose nothing, invent nothing, stay inside its bounds, and
 * terminate on input designed to make it not.
 *
 *   npx tsx scripts/verify-library-chunking.ts
 */
import { cleanPages, type Page } from '../src/lib/library/clean';
import { chunkPages, MAX_CHARS, MIN_CHARS } from '../src/lib/library/chunk';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const squash = (s: string) => s.replace(/\s+/g, '');

/** A believable book: running heads, paragraphs, a contents page, a bibliography. */
function makeBook(pageCount: number): Page[] {
  const pages: Page[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const head = `The Theory of Operations, Vol 3\n${i}\n`;
    let body: string;
    if (i === 2) {
      body = ['Contents', ...Array.from({ length: 10 }, (_, n) => `Chapter ${n + 1} .......... ${n * 12 + 9}`)].join('\n');
    } else if (i > pageCount - 3) {
      body = i === pageCount - 2
        ? 'References\n\nGoldratt, E. (1984). The Goal. North River Press.\n\nPorter, M. (1980). Competitive Strategy. Free Press.'
        : 'Deming, W. (1986). Out of the Crisis. MIT Press.\n\nOhno, T. (1988). Toyota Production System. Productivity Press.';
    } else {
      body = [
        `Chapter ${Math.ceil(i / 10)}`,
        `A bottleneck is any resource whose capacity is equal to or less than the demand placed upon it. `
          + `This is page ${i} of the argument, and it continues for some length so that the paragraph is `
          + `substantial enough to matter to a chunker that works in paragraphs rather than characters.`,
        'An hour lost at a bottleneck is an hour lost for the entire system. An hour saved at a\n'
          + 'non-bottleneck is a mirage. The distinction is the whole of the theory and everything fol-\n'
          + 'lows from it in one way or another across the remaining chapters of this book.',
      ].join('\n\n');
    }
    pages.push({ number: i, text: `${head}\n${body}\n\nJournal of Operations ${i}` });
  }
  return pages;
}

console.log('\nLibrary chunking\n');

const book = makeBook(60);
const cleaned = cleanPages(book);
const passages = chunkPages(cleaned);

console.log('Cleaning');
check('running heads are gone from the body', !passages.some((p) => p.text.includes('Journal of Operations')));
check('hyphenated line breaks are healed', passages.some((p) => p.text.includes('follows from it')));
check('a U+2010 line-break hyphen is healed too',
  chunkPages(cleanPages([{ number: 1, text: 'the sys\u2010\ntem works' }]))[0].text.includes('system works'));
check('an en dash is left alone',
  chunkPages(cleanPages([{ number: 1, text: 'pages 12\u201318 of it' }]))[0].text.includes('12\u201318'));
check('a genuine compound keeps its hyphen', passages.some((p) => p.text.includes('non-bottleneck')));
check('no raw line-break hyphen survives', !passages.some((p) => /[a-z]-\s/.test(p.text)));
check('the bibliography is tagged, not dropped',
  passages.some((p) => p.kind === 'backmatter' && p.text.includes('Goldratt')));
check('the contents page is tagged as front matter',
  passages.some((p) => p.kind === 'frontmatter'));

// A bibliography rarely starts on a fresh sheet. Splitting by page alone tags
// the closing paragraphs of the book as back matter and drops them out of
// retrieval — found by the first spike over a real PDF, kept honest here.
const shared = cleanPages([
  { number: 1, text: 'Body one.' }, { number: 2, text: 'Body two.' }, { number: 3, text: 'Body three.' },
  { number: 4, text: 'The final thought of the last chapter.\n\nReferences\n\nGoldratt, E. (1984). The Goal.' },
]);
const sharedPassages = chunkPages(shared);
check('a page holding both keeps its body text as body',
  sharedPassages.some((p) => p.kind === 'body' && p.text.includes('final thought')));
check('and its references as back matter',
  sharedPassages.some((p) => p.kind === 'backmatter' && p.text.includes('Goldratt')));
check('both halves still cite the page they came from',
  sharedPassages.some((p) => p.kind === 'body' && p.pageTo === 4)
  && sharedPassages.some((p) => p.kind === 'backmatter' && p.pageFrom === 4));

console.log('\nBounds');
const oversize = passages.filter((p) => p.charCount > MAX_CHARS);
check('no passage exceeds the ceiling', oversize.length === 0, `${oversize.length} over ${MAX_CHARS}`);
check('charCount matches the text it describes', passages.every((p) => p.charCount === p.text.length));
const orphans = passages.slice(0, -1).filter((p, i) => p.charCount < MIN_CHARS && p.kind === passages[i + 1].kind);
check('no mid-document orphan fragments', orphans.length === 0, `${orphans.length} orphans`);

console.log('\nStructure');
check('positions are dense and ordered', passages.every((p, i) => p.position === i));
check('every page range is inside the document', passages.every((p) => p.pageFrom >= 1 && p.pageTo <= 60));
check('page ranges never run backwards', passages.every((p) => p.pageFrom <= p.pageTo));
check('page ranges advance monotonically',
  passages.every((p, i) => i === 0 || p.pageFrom >= passages[i - 1].pageFrom));
check('a passage is never both body and back matter',
  new Set(passages.map((p) => p.kind)).size <= 3 && passages.every((p) => p.text.length > 0));

console.log('\nNothing lost, nothing invented');
const source = squash(cleaned.map((p) => p.text).join(''));
const rebuilt = squash(passages.map((p) => p.text).join(''));
check('reassembly reproduces the cleaned text exactly', rebuilt === source,
  `${rebuilt.length} vs ${source.length} chars`);

console.log('\nPathological input');
const giant: Page[] = [{ number: 1, text: 'x'.repeat(50_000) }];
const started = Date.now();
const giantPassages = chunkPages(cleanPages(giant));
check('one 50,000-character line terminates', Date.now() - started < 2000, `${Date.now() - started}ms`);
check('and is split within bounds', giantPassages.every((p) => p.charCount <= MAX_CHARS));
check('and loses nothing', squash(giantPassages.map((p) => p.text).join('')).length === 50_000);

const empty = chunkPages(cleanPages([{ number: 1, text: '   \n\n  \n' }]));
check('an empty page yields no passages', empty.length === 0, `${empty.length}`);

const noBreaks: Page[] = [{ number: 1, text: 'A sentence. '.repeat(1000) }];
check('prose with no paragraph breaks still splits',
  chunkPages(cleanPages(noBreaks)).every((p) => p.charCount <= MAX_CHARS));

console.log('\nDeterminism');
check('the same book chunks identically twice',
  JSON.stringify(chunkPages(cleanPages(makeBook(60)))) === JSON.stringify(passages));

console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed === 0 ? 0 : 1);
