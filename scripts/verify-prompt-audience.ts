/**
 * Checks the Audience section of the system prompt (src/lib/persona/prompt.ts):
 * only segments of the persona's own kind reach the model (owner decision
 * 2026-11-14 — segments copied from the category made 28 consumer personas
 * describe schools, universities or firms). No network, no database.
 *
 *   npx tsx scripts/verify-prompt-audience.ts
 */
import { buildSystemPrompt } from '../src/lib/persona/prompt';

const base = {
  name: 'Test', expertise: 'Testing', systemPrompt: 'You are a test persona.', personality: [], knowledgeDomains: [],
  blueprint: null, interactionStyle: null, approachToUnknown: null, promptTechnique: null, guardrails: [],
} as never as Parameters<typeof buildSystemPrompt>[0];

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

const prompt = (audienceType: 'B2C' | 'B2B' | 'B2G' | null, audienceSegments: string[]) =>
  buildSystemPrompt({ ...base, audienceType, audienceSegments } as never);

console.log('Prompt audience');
// An Education persona for learners, tagged with the field's institutional segments.
const tutor = prompt('B2C', ['B2B-SEC-01', 'B2G-PUB-04', 'B2C-CYP-03']);
check('a B2C persona describes only B2C people (KS2 learners), not EdTech firms or universities', () =>
  tutor.includes('KS2 Learners') && !tutor.includes('Universities') && !tutor.includes('EdTech'));
const onlyInstitutions = prompt('B2C', ['B2B-SEC-01', 'B2G-PUB-04']);
check('with no segment of its kind it keeps the general audience line, and names no institution', () =>
  onlyInstitutions.includes('## Audience') && !onlyInstitutions.includes('Specifically, these people') && !onlyInstitutions.includes('Universities'));
const firm = prompt('B2B', ['B2B-FUN-03', 'B2G-PUB-04']);
check('a B2B persona keeps its business segments and drops public bodies', () => firm.includes('Specifically, these people') && !firm.includes('Universities'));
check('no audience type, no Audience section (unchanged)', () => !prompt(null, ['B2C-CYP-03']).includes('## Audience'));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll prompt-audience checks passed.');
