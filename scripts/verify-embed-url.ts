/**
 * The video block's URL allow-list becomes an `<iframe src>`, so it is worth a
 * real test: an admin pasting an arbitrary string must not be able to embed
 * anything at all. Run with `npx tsx scripts/verify-embed-url.ts`.
 */
import { embedUrl } from '@/components/site/blocks';

const cases: [string, string | null][] = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
  ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
  ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
  ['javascript:alert(1)', null],
  ['data:text/html,<script>alert(1)</script>', null],
  ['https://evil.example.com/embed/x', null],
  ['https://youtube.com.evil.com/watch?v=abc123', null],
  ['https://vimeo.com/not-a-number', null],
  ['https://www.youtube.com/watch?v=<script>', null],
  ['not a url', null],
  ['', null],
];

let pass = 0;
for (const [input, expected] of cases) {
  const got = embedUrl(input);
  const ok = got === expected;
  if (ok) pass++;
  console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(input).slice(0, 46).padEnd(48), '->', got);
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
