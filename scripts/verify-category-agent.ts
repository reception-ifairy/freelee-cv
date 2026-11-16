/**
 * Checks the category agent (freelee #89): what it costs, what it may propose,
 * how a decision is recorded, and that its route sends nothing Claude Opus 5.5
 * rejects. Imports server-only modules, hence the react-server condition;
 * nothing here calls a model, the network or the database.
 *
 *   npx tsx --conditions=react-server scripts/verify-category-agent.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import type { Proposal } from '../src/lib/taxonomy/agent-proposals';
// convert.ts reaches the db module, which wants DATABASE_URL to exist (it is never used here).
config({ path: '.env.local', quiet: true });
const { AGENT_DEFAULT_MODEL, addUsage, estimateUsd, ZERO_USAGE } = await import('../src/lib/taxonomy/agent-pricing');
const { checkProposal, decide } = await import('../src/lib/taxonomy/agent-proposals');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function check(name: string, fn: () => boolean | string) {
  try {
    const r = fn();
    if (r !== true) throw new Error(typeof r === 'string' ? r : 'returned false');
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
const near = (a: number | null, b: number) => (a !== null && Math.abs(a - b) < 1e-9) || `got ${a}, want ${b}`;

console.log('Cost');
const M = 1_000_000;
check('the default model is Claude Opus 5.5', () => AGENT_DEFAULT_MODEL === 'claude-opus-5-5');
check('Opus 5.5: $4 a million input, $20 output', () => near(estimateUsd('claude-opus-5-5', { ...ZERO_USAGE, inputTokens: M, outputTokens: M }), 24));
check('cache reads at $0.20 a million, cache writes at 1.25× input ($5)', () =>
  near(estimateUsd('claude-opus-5-5', { ...ZERO_USAGE, cacheReadTokens: M, cacheWriteTokens: M }), 5.2));
check('an unknown model gives no estimate rather than a wrong one', () => estimateUsd('claude-opus-4-1', { ...ZERO_USAGE, inputTokens: 10 }) === null);
check('usage adds up across replies', () =>
  JSON.stringify(addUsage({ inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 }, { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheWriteTokens: 1 })) ===
  JSON.stringify({ inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 5 }));

console.log('Proposals');
const ctx = { sectorIds: [42, 43], linkedCodes: ['B2C-CYP-08'] };
const persona = { name: 'Fractions Coach', systemPrompt: 'You are a patient maths tutor for Year 4 who teaches fractions with pictures.' };
check('a complete bot is accepted, filed under one of the field’s sectors', () => {
  const r = checkProposal({ kind: 'bot', summary: 'A fractions tutor for KS2', sectorId: 42, persona }, ctx);
  return r.ok && r.payload.kind === 'bot' && r.payload.sectorId === 42 && r.payload.persona.promptTechnique === 'direct';
});
check('a bot without a system prompt is refused, naming the field', () => {
  const r = checkProposal({ kind: 'bot', summary: 'Half a bot', persona: { name: 'Nobody' } }, ctx);
  return !r.ok && r.error.includes('systemPrompt');
});
check('a bot filed under another field’s sector is refused', () => !checkProposal({ kind: 'bot', summary: 'Wrong field', sectorId: 7, persona }, ctx).ok);
check('a sector description needs one of the field’s sectors and 20–800 characters', () =>
  checkProposal({ kind: 'sector_description', summary: 'Clearer', sectorId: 43, description: 'One-to-one tutoring and preparation for school tests and GCSEs.' }, ctx).ok &&
  !checkProposal({ kind: 'sector_description', summary: 'Too short', sectorId: 43, description: 'Short.' }, ctx).ok &&
  !checkProposal({ kind: 'sector_description', summary: 'No sector', description: 'One-to-one tutoring and preparation for school tests.' }, ctx).ok);
check('audiences: unknown codes refused; codes normalised; already-linked ones dropped', () => {
  const unknown = checkProposal({ kind: 'audiences', summary: 'x', audienceCodes: ['B2C-XYZ-01'] }, ctx);
  const ok = checkProposal({ kind: 'audiences', summary: 'Parents', audienceCodes: ['b2c-gk-01', 'B2C-CYP-08', 'B2C-GK-01'], note: 'They pay.' }, ctx);
  const nothingNew = checkProposal({ kind: 'audiences', summary: 'x', audienceCodes: ['B2C-CYP-08'] }, ctx);
  return !unknown.ok && ok.ok && ok.payload.kind === 'audiences' && JSON.stringify(ok.payload.codes) === '["B2C-GK-01"]' && !nothingNew.ok;
});

console.log('Decisions');
const base: Proposal = { id: 'p1', createdAt: '2026-11-16T00:00:00Z', summary: 's', status: 'pending', payload: { kind: 'audiences', codes: ['B2C-GK-01'], note: null } };
check('approving a pending proposal records it, with the draft it created', () => {
  const r = decide([base], 'p1', 'approved', { personaId: 9 });
  return r.ok && r.proposals[0].status === 'approved' && r.proposals[0].personaId === 9 && Boolean(r.proposals[0].decidedAt);
});
check('a decided proposal cannot be decided again; an unknown one is refused', () => {
  const once = decide([base], 'p1', 'rejected');
  return once.ok && !decide(once.proposals, 'p1', 'approved').ok && !decide([base], 'nope', 'approved').ok;
});

console.log('Route');
const route = readFileSync(join(ROOT, 'src/app/api/admin/workbench/route.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('always Anthropic, the model from the setting', () => route.includes("getModel(registry, 'anthropic', modelId, keys)") && route.includes('categoryAgentModel()'));
check('no sampling parameters and no forced tool choice (Opus 5.5 rejects both)', () => !/temperature|topP|topK|toolChoice/.test(route));
check('the system prompt is cached', () => /cacheControl:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(route));
check('one tool, propose, and a step limit', () => route.includes('tools: { propose }') && route.includes('stepCountIs('));
check('no key: a clear 503, never a silent switch to another provider', () => route.includes('if (!keyReady)') && route.includes('status: 503'));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll category-agent checks passed.');
process.exit(0);
