import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { getSettingString } from '@/lib/settings';
import { resolveProviderKeys } from '@/lib/ai/registry';
import { hubTutors } from '@/lib/curriculum/hub-queries';
import { getSubjectsDictionary } from '@/lib/curriculum/subjects-cache';
import { coverageGrid } from '@/lib/curriculum/coverage';
import { categoryBrief, briefForModel } from './brief';
import { extrasFor } from './category-extras';
import { AGENT_DEFAULT_MODEL, AGENT_MODELS, ZERO_USAGE, addUsage, estimateUsd, type AgentUsage } from './agent-pricing';
import type { Proposal } from './agent-proposals';
import type { PlanItem } from './agent-plan';
import { categoryBots } from './agent-scan';

/**
 * The category agent (owner, 2026-11-16): every category has an AI agent on
 * Anthropic that knows its field — the brief, its bots, its sectors and gaps —
 * and helps design bots for it. It proposes; the owner approves.
 *
 * The thread is the category's `playground` conversation (one per category,
 * keyed by `settings.categoryId`). Its `settings` also hold the proposals and
 * the running token usage, so nothing needs a new table.
 */

/** The model the agent runs on: always Anthropic; the model is a setting (Settings → AI defaults). */
export async function categoryAgentModel(): Promise<{ modelId: string; label: string; keyReady: boolean }> {
  const [configured, keys] = await Promise.all([getSettingString('category_agent_model'), resolveProviderKeys('anthropic')]);
  const modelId = configured.trim() || AGENT_DEFAULT_MODEL;
  return {
    modelId,
    label: AGENT_MODELS[modelId]?.label ?? modelId,
    // A key saved in Connections, or the server file's ANTHROPIC_API_KEY.
    keyReady: Boolean(keys.apiKey || process.env.ANTHROPIC_API_KEY),
  };
}

export type AgentThreadState = { proposals: Proposal[]; plan: PlanItem[]; usage: AgentUsage; usd: number | null; modelId: string };

/** The thread's own state: the plan of first bots (agent-plan.ts) and the proposals sit beside the usage. */
export type ThreadSettings = { categoryId?: number; proposals?: Proposal[]; plan?: PlanItem[]; usage?: AgentUsage; usageModel?: string };

export async function readThread(conversationId: string): Promise<ThreadSettings | null> {
  const [row] = await db
    .select({ kind: conversations.kind, settings: conversations.settings })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || row.kind !== 'playground') return null;
  return (row.settings ?? {}) as ThreadSettings;
}

/**
 * Read-modify-write of a thread's settings under a row lock, so a proposal
 * stored by the tool and the usage stored when the reply finishes never
 * overwrite each other.
 */
export async function updateThread(conversationId: string, change: (settings: ThreadSettings) => ThreadSettings): Promise<ThreadSettings> {
  return db.transaction(async (tx) => {
    const [row] = await tx.execute<{ settings: ThreadSettings | null }>(
      sql`select settings from ${conversations} where id = ${conversationId} for update`,
    );
    const next = change((row?.settings ?? {}) as ThreadSettings);
    await tx.update(conversations).set({ settings: next as never }).where(eq(conversations.id, conversationId));
    return next;
  });
}

export function threadState(settings: ThreadSettings, modelId: string): AgentThreadState {
  const usage = settings.usage ?? ZERO_USAGE;
  return {
    proposals: settings.proposals ?? [],
    plan: settings.plan ?? [],
    usage,
    // Priced at the model that ran, when it is known; usage from mixed models is priced at the current one.
    usd: estimateUsd(settings.usageModel ?? modelId, usage),
    modelId,
  };
}

export async function recordUsage(conversationId: string, modelId: string, usage: AgentUsage): Promise<void> {
  await updateThread(conversationId, (s) => ({ ...s, usage: addUsage(s.usage ?? ZERO_USAGE, usage), usageModel: modelId }));
}

/**
 * Everything the agent knows about its category, as prose for the system
 * prompt: the researched brief, every bot filed here (live or not, its
 * sector, its kind), the sectors with no bot, and — on the category with the
 * homeschool hub — the tutors and the subject × key stage gaps.
 */
export async function agentContext(
  categoryId: number,
): Promise<{
  text: string;
  sectorIds: number[];
  sectors: { id: number; name: string }[];
  linkedCodes: string[];
  useCases: { id: number; title: string }[];
} | null> {
  const brief = await categoryBrief(categoryId);
  if (!brief) return null;

  // The live version, or the draft while there is none: the agent's own drafts have only a draft.
  const bots = await categoryBots(categoryId);
  const sectorName = (id: number | null) => brief.sectors.find((s) => s.id === id)?.name ?? null;

  const lines: string[] = [briefForModel(brief), '', '## The bots already in this field'];
  if (bots.length === 0) lines.push('None yet.');
  for (const b of bots) {
    lines.push(`- ${b.name} (${b.isActive ? 'live' : 'not live'}; ${b.audienceType ?? 'no audience type'}; sector: ${sectorName(b.sectorId) ?? 'none'})${b.tagline ? ` — ${b.tagline}` : ''}`);
  }

  // Counted from the bots above: the brief itself carries no per-sector counts.
  const botsIn = (sectorId: number) => bots.filter((b) => b.sectorId === sectorId).length;
  const empty = brief.sectors.filter((s) => botsIn(s.id) === 0);
  lines.push('', '## Sectors (use these ids in proposals)');
  for (const s of brief.sectors) lines.push(`- id ${s.id}: ${s.name} — ${botsIn(s.id)} bot(s)${s.description ? ` — ${s.description}` : ''}`);
  if (empty.length) lines.push('', `Sectors with no bot yet: ${empty.map((s) => s.name).join(', ')}.`);

  lines.push('', `## Audience groups already linked: ${brief.audiences.map((a) => a.code).join(', ') || 'none'}`);

  if (extrasFor(brief.slug).homeschoolHub) {
    const [tutors, dict] = await Promise.all([hubTutors(), getSubjectsDictionary()]);
    const grid = coverageGrid(tutors, dict);
    const gaps = grid.rows
      .map((r) => ({ subject: r.option.label, stages: r.cells.filter((c) => c.offered && c.live === 0).map((c) => c.keyStage) }))
      .filter((g) => g.stages.length);
    lines.push(
      '',
      '## Homeschooling (this field holds the homeschool offer)',
      `Curriculum tutors: ${tutors.length} (${tutors.filter((t) => t.isActive).length} live). ${tutors.map((t) => `${t.name}: ${t.keyStages.join('/')} ${t.subjects.join(', ')}`).join('; ')}`,
      `Subject × key stage pairs a parent can choose: ${grid.offered}; with a live tutor: ${grid.coveredLive}.`,
      `Gaps (no live tutor): ${gaps.map((g) => `${g.subject} ${g.stages.join('/')}`).join('; ') || 'none'}.`,
      'A tutor for children is a bot with a curriculum scope set by the owner in its editor; propose the character and teaching approach, and say which key stages and subjects it should cover.',
    );
  }

  return {
    text: lines.join('\n'),
    sectorIds: brief.sectors.map((s) => s.id),
    sectors: brief.sectors.map((s) => ({ id: s.id, name: s.name })),
    linkedCodes: brief.audiences.map((a) => a.code),
    useCases: brief.useCases.map((u) => ({ id: u.id, title: u.title })),
  };
}
