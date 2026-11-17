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
const { checkPlan, afterDecision, updatePlanItem, planForModel } = await import('../src/lib/taxonomy/agent-plan');
const { renderCategoryScan, renderAudienceScan } = await import('../src/lib/taxonomy/agent-scan');

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

check('a bot carries the groups it is for, all of its own type; the type follows the groups', () => {
  const ok = checkProposal({ kind: 'bot', summary: 'KS2 fractions', persona, audienceCodes: ['b2c-cyp-03', 'B2C-GK-01'], planItemId: 'i1' }, ctx);
  const mixed = checkProposal({ kind: 'bot', summary: 'Mixed', persona: { ...persona, audienceType: 'B2C' }, audienceCodes: ['B2C-CYP-03', 'B2B-SIZE-01'] }, ctx);
  const unknown = checkProposal({ kind: 'bot', summary: 'Unknown', persona, audienceCodes: ['B2C-NOPE-01'] }, ctx);
  return (
    ok.ok && ok.payload.kind === 'bot' && JSON.stringify(ok.payload.segments) === '["B2C-CYP-03","B2C-GK-01"]' &&
    ok.payload.planItemId === 'i1' && ok.payload.persona.audienceType === 'B2C' && !mixed.ok && !unknown.ok
  );
});

console.log('The plan of first bots');
let n = 0;
const ids = () => `i${++n}`;
const plan1 = checkPlan(
  { items: [{ name: 'Fractions Coach', sectorId: 42, audienceCodes: ['B2C-CYP-03'], why: 'Most asked-for KS2 topic.' }, { name: 'GCSE Revision Planner', why: 'Exam season.' }] },
  { sectorIds: [42, 43], previous: [], newId: ids },
);
check('a plan is saved in order, each item to do; the type follows its groups', () =>
  plan1.ok && plan1.plan.map((p) => `${p.name}:${p.status}:${p.audienceType}`).join('|') === 'Fractions Coach:todo:B2C|GCSE Revision Planner:todo:null');
check('a plan item in another field’s sector, or with groups of two types, is refused', () =>
  !checkPlan({ items: [{ name: 'Wrong', sectorId: 7, why: 'Wrong field.' }] }, { sectorIds: [42], previous: [] }).ok &&
  !checkPlan({ items: [{ name: 'Mixed', audienceCodes: ['B2C-CYP-03', 'B2B-SIZE-01'], why: 'Two kinds.' }] }, { sectorIds: [42], previous: [] }).ok);
check('proposing marks the item; approving drafts it with the bot; rejecting puts it back', () => {
  if (!plan1.ok) return false;
  const proposed = updatePlanItem(plan1.plan, 'i1', { status: 'proposed', proposalId: 'p9' });
  const approved = afterDecision(proposed, 'p9', 'approved', 77);
  const rejected = afterDecision(proposed, 'p9', 'rejected');
  return proposed[0].status === 'proposed' && approved[0].status === 'drafted' && approved[0].personaId === 77 && rejected[0].status === 'todo' && !rejected[0].proposalId;
});
check('saving a new plan keeps what is proposed or drafted, replaces the rest', () => {
  if (!plan1.ok) return false;
  const drafted = afterDecision(updatePlanItem(plan1.plan, 'i1', { status: 'proposed', proposalId: 'p9' }), 'p9', 'approved', 77);
  const plan2 = checkPlan({ items: [{ name: 'Times Tables Trainer', why: 'Year 4 check.' }, { name: 'fractions coach', why: 'Dup.' }] }, { sectorIds: [42], previous: drafted, newId: ids });
  return plan2.ok && plan2.plan.map((p) => p.name).join('|') === 'Fractions Coach|Times Tables Trainer';
});
check('the agent reads the plan with each item’s id and what is next', () => {
  if (!plan1.ok) return false;
  const text = planForModel(plan1.plan, () => 'Early Years');
  return text.includes('planItemId i1') && text.includes('[todo]') && text.includes('Next to draft: Fractions Coach.');
});

console.log('Scans');
const bots = [
  { id: 1, name: 'Story Sprout', tagline: null, isActive: true, sectorId: 42, audienceType: 'B2C', segments: ['B2C-CYP-01'] },
  { id: 2, name: 'Draft Tutor', tagline: null, isActive: false, sectorId: null, audienceType: null, segments: null },
];
const scan = renderCategoryScan(
  {
    name: 'Education',
    riskLevel: 'R2',
    audienceLean: { b2c: 70, b2b: 30, b2g: 50 },
    sectors: [
      { id: 42, name: 'Early Years', b2c: 90, b2b: 20, b2g: 70 },
      { id: 43, name: 'Tutoring', b2c: 80, b2b: 10, b2g: 10 },
    ] as never,
  },
  bots,
);
check('the category scan lists sectors with ids and bots, and finds the gaps', () =>
  scan.includes('id 42 · Early Years') && scan.includes('Tutoring (id 43) has no bot at all.') &&
  scan.includes('Early Years suits B2G (70) but no B2G bot is filed there.') && scan.includes('1 bot(s) here have no sector.') && scan.includes('1 bot(s) are not live'));
const aud = renderAudienceScan({ name: 'Education', linked: [{ code: 'B2C-CYP-08', note: 'Home ed.' }] }, bots, [['B2C-CYP-01'], ['B2C-CYP-01']], 'B2C');
check('the audience scan: one type only, linked groups with their note, bots here and on the platform', () =>
  !aud.includes('## B2B') && aud.includes('B2C-CYP-08 · Home Educated') && aud.includes('LINKED here (“Home ed.”)') &&
  /B2C-CYP-01 · Early Years.*bots here: 1 · on the platform: 2/.test(aud) && aud.includes('no bot here is for them: B2C-CYP-08 Home Educated') &&
  aud.includes('which the field does not link: B2C-CYP-01 Early Years'));

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
check('the tools: two scans, read a bot, save the plan, propose — and a step limit', () =>
  route.includes('tools: { scan_category, scan_audiences, read_bot, save_plan, propose }') && route.includes('stepCountIs('));
check('earlier thinking is not sent back (Opus 5.5 binds it to a prefix that changes here)', () =>
  route.includes("part.type !== 'reasoning'") && route.includes('convertToModelMessages(withoutReasoning(uiMessages))'));
check('the newest message is a cache breakpoint too, so the scans are not paid for twice', () => route.includes('last.providerOptions'));
check('no key: a clear 503, never a silent switch to another provider', () => route.includes('if (!keyReady)') && route.includes('status: 503'));
// AI SDK v7 throws "System messages are not allowed in the prompt or messages fields" otherwise (#97).
check('the system prompt and the plan go through `instructions`, not `messages`', () =>
  route.includes('instructions: [system, planNow]') && route.includes('messages: history') && !/messages:\s*\[\s*system/.test(route));
check('a failed stream shows its real reason, not the SDK’s masked "An error occurred."', () => /toUIMessageStreamResponse\(\{\s*onError/.test(route));

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll category-agent checks passed.');
process.exit(0);
