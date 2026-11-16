import { z } from 'zod';
import { AUDIENCE_SEGMENTS } from '@/lib/persona/audience-segments';

/**
 * The plan of a category's first bots (owner, 2026-11-16: "each agent scans
 * the audiences and its category, then helps me, one by one, to create the
 * first bot drafts").
 *
 * After its scan the agent saves an ordered list of the bots worth building
 * first — the `save_plan` tool — and then works through it one at a time: a
 * bot proposal names its plan item, approving it marks the item drafted.
 * The plan is a working list in the agent's thread (`conversations.settings`),
 * not a catalogue change, so the agent may save it without approval.
 *
 * Plain module (no database), checked by scripts/verify-category-agent.ts.
 */
export const PLAN_STATUSES = ['todo', 'proposed', 'drafted', 'skipped'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export type AudienceType = 'B2C' | 'B2B' | 'B2G';

export type PlanItem = {
  id: string;
  name: string;
  sectorId: number | null;
  audienceType: AudienceType | null;
  /** Audience segment codes the bot is for. */
  segments: string[];
  why: string;
  status: PlanStatus;
  /** The pending proposal for this item, while there is one. */
  proposalId?: string;
  /** The draft created when its proposal was approved. */
  personaId?: number;
};

export const MAX_PLAN_ITEMS = 8;

export const planInputSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(2).max(80).describe('A working name for the bot, e.g. "Landing-page ASA checker".'),
        sectorId: z.number().int().optional().describe('The sector it belongs to (an id from scan_category), if any.'),
        audienceType: z.enum(['B2C', 'B2B', 'B2G']).optional(),
        audienceCodes: z.array(z.string()).optional().describe('Audience segment codes it is for (from scan_audiences).'),
        why: z.string().min(5).max(400).describe('One sentence: why this bot, and why at this place in the order.'),
      }),
    )
    .min(1)
    .max(MAX_PLAN_ITEMS)
    .describe('The first bots to build, in the order to build them: the one that earns or helps most, soonest, first.'),
});
export type PlanInput = z.infer<typeof planInputSchema>;

/**
 * Checks a plan against the field and merges it with the one already saved:
 * items already proposed or drafted stay (at the top, in their order); the
 * rest of the old plan is replaced. Returns the new plan or an error the
 * agent can act on.
 */
export function checkPlan(
  input: PlanInput,
  ctx: { sectorIds: number[]; previous: readonly PlanItem[]; newId?: () => string },
): { ok: true; plan: PlanItem[] } | { ok: false; error: string } {
  const newId = ctx.newId ?? (() => crypto.randomUUID());
  const fresh: PlanItem[] = [];
  for (const [index, item] of input.items.entries()) {
    if (item.sectorId !== undefined && !ctx.sectorIds.includes(item.sectorId)) {
      return { ok: false, error: `Item ${index + 1}: sector ${item.sectorId} is not in this field. Use one of ${ctx.sectorIds.join(', ') || 'none'}, or leave it out.` };
    }
    const codes = [...new Set((item.audienceCodes ?? []).map((c) => c.trim().toUpperCase()))];
    const unknown = codes.filter((c) => !AUDIENCE_SEGMENTS[c]);
    if (unknown.length) return { ok: false, error: `Item ${index + 1}: unknown audience codes ${unknown.join(', ')}.` };
    const type = item.audienceType ?? (codes[0] ? AUDIENCE_SEGMENTS[codes[0]].audienceType : null);
    const mixed = codes.filter((c) => type && AUDIENCE_SEGMENTS[c].audienceType !== type);
    if (mixed.length) {
      return { ok: false, error: `Item ${index + 1}: ${mixed.join(', ')} are not ${type} groups. A bot serves one audience type; split it or drop them.` };
    }
    fresh.push({ id: newId(), name: item.name.trim(), sectorId: item.sectorId ?? null, audienceType: type, segments: codes, why: item.why.trim(), status: 'todo' });
  }

  const kept = ctx.previous.filter((p) => p.status === 'proposed' || p.status === 'drafted');
  const keptNames = new Set(kept.map((p) => p.name.toLowerCase()));
  const plan = [...kept, ...fresh.filter((p) => !keptNames.has(p.name.toLowerCase()))];
  if (plan.length > MAX_PLAN_ITEMS + kept.length) return { ok: false, error: `At most ${MAX_PLAN_ITEMS} new items.` };
  return { ok: true, plan };
}

/** Changes one item; an unknown id leaves the plan as it was. */
export function updatePlanItem(plan: readonly PlanItem[], id: string | undefined, change: Partial<PlanItem>): PlanItem[] {
  if (!id) return [...plan];
  return plan.map((item) => (item.id === id ? { ...item, ...change } : item));
}

/** The item a proposal belongs to, after its proposal was approved or rejected. */
export function afterDecision(plan: readonly PlanItem[], proposalId: string, decision: 'approved' | 'rejected', personaId?: number): PlanItem[] {
  return plan.map((item) => {
    if (item.proposalId !== proposalId) return item;
    return decision === 'approved'
      ? { ...item, status: 'drafted' as const, personaId, proposalId: undefined }
      : { ...item, status: 'todo' as const, proposalId: undefined };
  });
}

/** The plan as the agent reads it at the start of every turn. */
export function planForModel(plan: readonly PlanItem[], sectorName: (id: number) => string): string {
  if (plan.length === 0) return 'No plan saved yet. Start with the scan, then save a plan of the first bots.';
  const lines = plan.map((item, index) => {
    const bits = [
      item.sectorId !== null ? `sector ${sectorName(item.sectorId)} (id ${item.sectorId})` : null,
      item.audienceType,
      item.segments.length ? item.segments.join(', ') : null,
    ].filter(Boolean);
    return `${index + 1}. [${item.status}] ${item.name} — planItemId ${item.id}${bits.length ? ` — ${bits.join('; ')}` : ''} — ${item.why}`;
  });
  const next = plan.find((item) => item.status === 'todo');
  return [...lines, '', next ? `Next to draft: ${next.name}.` : 'Every item is proposed, drafted or skipped.'].join('\n');
}
