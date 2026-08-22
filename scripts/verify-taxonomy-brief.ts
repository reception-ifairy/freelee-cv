/**
 * A brief is the only thing that carries the taxonomy's research into a model.
 * If it silently drops a field, nobody notices — the answers just get vaguer.
 * So the properties worth asserting are the ones a briefing must have: it names
 * the field, it survives missing data, it stays inside a budget, and it never
 * emits the word "undefined" at a language model.
 *
 *   npx tsx scripts/verify-taxonomy-brief.ts
 */
import { briefForModel } from '../src/lib/taxonomy/render';
import type { CategoryBrief } from '../src/lib/taxonomy/types';
import { AUDIENCE_SEGMENTS } from '../src/lib/persona/audience-segments';
import { GUARDRAILS } from '../src/lib/persona/guardrails';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function makeBrief(over: Partial<CategoryBrief> = {}): CategoryBrief {
  return {
    id: 29,
    name: 'Education and Training',
    slug: 'education-and-training',
    description: 'AI solutions for instruction and skill acquisition',
    color: '#6366f1',
    market: {
      size: '£3.5 billion EdTech',
      growth: '15% annually',
      regulations: ['Safeguarding_KCSIE', 'Equality_Act_2010'],
      industryBodies: ['BETT', 'EdTech_UK'],
    },
    riskLevel: 'R0',
    narrativePotential: 'very_high',
    sectors: Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Specialism ${i + 1}`,
      slug: `specialism-${i + 1}`,
      description: 'Something specific',
      b2c: 70, b2b: 90, b2g: 60,
      riskLevel: 'R0',
      narrativeFit: 'high',
      interactionModes: ['COACH', 'NARRATOR'],
      personaCount: 0,
    })),
    audiences: [
      { ...AUDIENCE_SEGMENTS['B2C-CYP-01'], note: 'The youngest readers.' },
      { ...AUDIENCE_SEGMENTS['B2B-SEC-01'], note: null },
    ],
    audienceLean: { b2c: 70, b2b: 90, b2g: 60 },
    layout: { key: 'learning', label: 'Learning' },
    suggestedTools: [{ key: 'calculator', label: 'Calculator' }],
    guardrails: [GUARDRAILS['crisis_escalation'] ?? Object.values(GUARDRAILS)[0]],
    ...over,
  };
}

console.log('\nCategory briefs\n');

const full = briefForModel(makeBrief());

console.log('Completeness');
check('names the field', full.includes('Education and Training'));
check('carries the market', full.includes('£3.5 billion EdTech') && full.includes('15% annually'));
check('carries the regulation, readably', full.includes('Safeguarding KCSIE'), 'underscores must go');
check('explains what the risk level means', /Risk level R0\*\* — .+/.test(full));
check('lists the specialisms', full.includes('Specialism 1') && full.includes('Specialism 6'));
check('says who the field serves', full.includes('Early Years'));
check('carries the operator’s own note', full.includes('The youngest readers.'));
check('carries what an audience needs', full.includes('play based learning'));
check('carries how to speak to them', full.includes('playful'));
check('lists the safeguards', full.includes('## Safeguards expected here'));

console.log('\nNever leaks a placeholder');
check('no "undefined" anywhere', !full.includes('undefined'), 'a model would read it as content');
check('no "null" anywhere', !/\bnull\b/.test(full));
check('no raw snake_case survives in prose', !/[a-z]_[a-z]/.test(full.replace(/```[\s\S]*?```/g, '')));

console.log('\nSurvives missing data');
const bare = briefForModel(makeBrief({
  description: null,
  market: { size: null, growth: null, regulations: [], industryBodies: [] },
  riskLevel: null,
  narrativePotential: null,
  sectors: [],
  audiences: [],
  guardrails: [],
}));
check('an empty field still produces a brief', bare.includes('Education and Training'));
check('and says plainly that nobody chose an audience', bare.includes('Nobody has recorded an audience'));
check('and still leaks no placeholder', !bare.includes('undefined') && !/\bnull\b/.test(bare));

console.log('\nBudget');
const biggest = briefForModel(makeBrief({
  sectors: Array.from({ length: 11 }, (_, i) => ({
    id: i, name: `Sector ${i}`, slug: `s${i}`,
    description: 'A specialism with a reasonably long description attached to it, as the real ones have.',
    b2c: 80, b2b: 90, b2g: 70, riskLevel: 'R2', narrativeFit: 'medium',
    interactionModes: ['COACH', 'AGENT', 'ANALYST'], personaCount: 0,
  })),
  audiences: Object.values(AUDIENCE_SEGMENTS).slice(0, 10).map((s) => ({ ...s, note: null })),
  guardrails: Object.values(GUARDRAILS),
}));
check('the largest possible brief stays under 6000 characters', biggest.length < 6000, `${biggest.length}`);
check('and caps the sector list rather than growing forever', biggest.includes('…and 3 more.'));

console.log('\nDeterminism');
check('the same brief renders identically twice', briefForModel(makeBrief()) === full);

console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed === 0 ? 0 : 1);
