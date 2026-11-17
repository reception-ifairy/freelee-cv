import 'server-only';
import { z } from 'zod';
import { convertedPersonaSchema, type ConvertedPersona } from '@/lib/persona/convert';
import { AUDIENCE_SEGMENTS, isAudienceSegmentCode } from '@/lib/persona/audience-segments';

/**
 * What the category agent may propose, and how a proposal is checked before
 * it is shown (owner, 2026-11-16: "the agent proposes, I approve"). The agent
 * never writes to the catalogue: its one tool, `propose`, only puts a checked
 * proposal on the category's list; Approve runs the ordinary admin action.
 *
 * Four kinds:
 * - `bot` — a new specialist, created on approval as an inactive draft;
 * - `sector_description` — a better description for one of the field's sectors;
 * - `audiences` — audience groups to link to the field, with a note on why;
 * - `b2c_design` — the field's B2C foundation (#98): the consumer groups it
 *   serves, each with its own note, and the everyday uses a member of the
 *   public would come for. On approval the groups are linked and the uses
 *   saved to category_use_cases.
 */
export const PROPOSAL_KINDS = ['bot', 'sector_description', 'audiences', 'b2c_design'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
export type ProposalStatus = 'pending' | 'approved' | 'rejected';

/**
 * The tool's input, flat on purpose: one schema the model fills reliably,
 * checked per kind in `checkProposal` (a union of three nested shapes is
 * harder for a model to fill and gives worse error messages).
 */
export const proposeInputSchema = z.object({
  kind: z
    .enum(PROPOSAL_KINDS)
    .describe(
      'bot = a new specialist; sector_description = rewrite one sector description; audiences = link audience groups to this field; b2c_design = the field’s consumer side: B2C groups and everyday uses.',
    ),
  summary: z.string().min(5).max(300).describe('One sentence for the owner: what this changes and why.'),
  sectorId: z.number().int().optional().describe('bot: the sector to file it under (optional). sector_description: the sector to rewrite (required).'),
  description: z.string().optional().describe('sector_description only: the new description, 1-3 sentences.'),
  audienceCodes: z
    .array(z.string())
    .optional()
    .describe('audiences: segment codes to link to this field, such as B2C-CYP-08. bot: the groups this bot is for (all of its own audience type).'),
  planItemId: z.string().optional().describe('bot: the planItemId of the plan item this bot drafts, when it is one.'),
  useCaseId: z.number().int().optional().describe('bot: the everyday use case (its id from the brief) this bot serves, when it is one.'),
  groups: z
    .array(z.object({ code: z.string(), note: z.string().optional() }))
    .optional()
    .describe('b2c_design only: B2C groups to link to this field, each with why they come here (one sentence).'),
  useCases: z
    .array(
      z.object({
        title: z.string().describe('Short, in the person’s terms: "Cut the weekly food shop", not "Nutrition bot".'),
        situation: z.string().describe('Who, and when they need it: one or two sentences.'),
        firstMessage: z.string().optional().describe('What they would type first, in their own words.'),
        audienceCodes: z.array(z.string()).describe('The B2C groups it is for.'),
        budgetFriendly: z.boolean().describe('True when it saves money or helps someone with little of it.'),
        sectorId: z.number().int().optional().describe('The sector it belongs to, by id, when one fits.'),
      }),
    )
    .optional()
    .describe('b2c_design only: 3 to 6 everyday uses, at least one budget-friendly.'),
  note: z.string().optional().describe('audiences only: why these people matter to this field, in one or two sentences.'),
  persona: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'bot only: the persona as an object with name, tagline, description, expertise, systemPrompt, welcomeMessage, suggestions (max 4), knowledgeDomains, audienceType (B2B|B2C|B2G), interactionStyle, approachToUnknown, promptTechnique, personality (traits 0-100).',
    ),
});
export type ProposeInput = z.infer<typeof proposeInputSchema>;

export type UseCaseDraft = {
  title: string;
  situation: string;
  firstMessage: string | null;
  segmentCodes: string[];
  budgetFriendly: boolean;
  sectorId: number | null;
};

export type ProposalPayload =
  | { kind: 'bot'; sectorId: number | null; persona: ConvertedPersona; segments?: string[]; planItemId?: string; useCaseId?: number }
  | { kind: 'sector_description'; sectorId: number; description: string }
  | { kind: 'audiences'; codes: string[]; note: string | null }
  | { kind: 'b2c_design'; groups: { code: string; note: string | null }[]; useCases: UseCaseDraft[] };

export type Proposal = {
  id: string;
  createdAt: string;
  summary: string;
  status: ProposalStatus;
  decidedAt?: string;
  /** Set on approval of a bot: the draft that was created. */
  personaId?: number;
  payload: ProposalPayload;
};

/** What a proposal may refer to: this field's sectors, the audience groups it already links, its everyday uses. */
export type ProposalContext = { sectorIds: number[]; linkedCodes: string[]; useCases?: { id: number; title: string }[] };

const MAX_USE_CASES = 8;
const norm = (code: string) => code.trim().toUpperCase();
const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The B2C foundation, checked: B2C groups only, uses that are concrete, at least one for a tight budget. */
function checkB2cDesign(input: ProposeInput, ctx: ProposalContext): { ok: true; payload: ProposalPayload } | { ok: false; error: string } {
  const notB2c = (code: string) => !isAudienceSegmentCode(code) || AUDIENCE_SEGMENTS[code].audienceType !== 'B2C';

  const seen = new Set<string>();
  const groups: { code: string; note: string | null }[] = [];
  for (const g of input.groups ?? []) {
    const code = norm(g.code);
    if (notB2c(code)) return { ok: false, error: `${code} is not a B2C group in the catalogue.` };
    if (seen.has(code) || ctx.linkedCodes.includes(code)) continue;
    seen.add(code);
    const note = (g.note ?? '').trim();
    groups.push({ code, note: note ? note.slice(0, 500) : null });
  }

  const raw = input.useCases ?? [];
  if (raw.length === 0) return { ok: false, error: 'b2c_design needs useCases: 3 to 6 everyday uses.' };
  if (raw.length > MAX_USE_CASES) return { ok: false, error: `At most ${MAX_USE_CASES} use cases in one design; keep the best.` };

  const useCases: UseCaseDraft[] = [];
  for (const [i, u] of raw.entries()) {
    const title = u.title.trim();
    const situation = u.situation.trim();
    const where = `useCases[${i}] (“${title || '…'}”)`;
    if (title.length < 3 || title.length > 80) return { ok: false, error: `${where}: the title must be 3-80 characters.` };
    if (situation.length < 20 || situation.length > 400) return { ok: false, error: `${where}: the situation must be 20-400 characters.` };
    if ((ctx.useCases ?? []).some((e) => sameTitle(e.title, title)) || useCases.some((e) => sameTitle(e.title, title))) {
      return { ok: false, error: `${where}: this field already has a use case with that title.` };
    }
    const codes = [...new Set(u.audienceCodes.map(norm))];
    if (codes.length === 0) return { ok: false, error: `${where}: name at least one B2C group it is for.` };
    const bad = codes.filter(notB2c);
    if (bad.length) return { ok: false, error: `${where}: ${bad.join(', ')} are not B2C groups.` };
    if (u.sectorId !== undefined && !ctx.sectorIds.includes(u.sectorId)) {
      return { ok: false, error: `${where}: sector ${u.sectorId} is not in this field. Use one of: ${ctx.sectorIds.join(', ') || 'none'}, or leave it out.` };
    }
    const first = (u.firstMessage ?? '').trim();
    useCases.push({ title, situation, firstMessage: first ? first.slice(0, 300) : null, segmentCodes: codes, budgetFriendly: u.budgetFriendly, sectorId: u.sectorId ?? null });
  }
  if (!useCases.some((u) => u.budgetFriendly)) {
    return { ok: false, error: 'At least one use case must be budget-friendly: something that saves money or helps someone with little of it.' };
  }
  return { ok: true, payload: { kind: 'b2c_design', groups, useCases } };
}

export function checkProposal(input: ProposeInput, ctx: ProposalContext): { ok: true; payload: ProposalPayload } | { ok: false; error: string } {
  if (input.kind === 'bot') {
    const parsed = convertedPersonaSchema.safeParse(input.persona ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: `The persona is incomplete: ${issue.path.join('.') || 'persona'}: ${issue.message}.` };
    }
    if (input.sectorId !== undefined && !ctx.sectorIds.includes(input.sectorId)) {
      return { ok: false, error: `Sector ${input.sectorId} is not in this field. Use one of: ${ctx.sectorIds.join(', ') || 'none'}, or leave it out.` };
    }
    // The groups the bot is for: known codes, all of the bot's own audience type
    // (a group of another type is stored but never reaches the prompt, #77).
    const segments = [...new Set((input.audienceCodes ?? []).map((c) => c.trim().toUpperCase()))];
    const unknownSegments = segments.filter((c) => !isAudienceSegmentCode(c));
    if (unknownSegments.length) return { ok: false, error: `Unknown audience codes: ${unknownSegments.join(', ')}.` };
    const type = parsed.data.audienceType ?? (segments[0] ? AUDIENCE_SEGMENTS[segments[0]].audienceType : undefined);
    const otherType = segments.filter((c) => type && AUDIENCE_SEGMENTS[c].audienceType !== type);
    if (otherType.length) {
      return { ok: false, error: `${otherType.join(', ')} are not ${type} groups; a bot serves one audience type. Drop them or change persona.audienceType.` };
    }
    const persona = type && !parsed.data.audienceType ? { ...parsed.data, audienceType: type } : parsed.data;
    if (input.useCaseId !== undefined && !(ctx.useCases ?? []).some((u) => u.id === input.useCaseId)) {
      return { ok: false, error: `Use case ${input.useCaseId} is not in this field. Use an id from the brief, or leave it out.` };
    }
    return {
      ok: true,
      payload: {
        kind: 'bot',
        sectorId: input.sectorId ?? null,
        persona,
        ...(segments.length ? { segments } : {}),
        ...(input.planItemId ? { planItemId: input.planItemId } : {}),
        ...(input.useCaseId !== undefined ? { useCaseId: input.useCaseId } : {}),
      },
    };
  }

  if (input.kind === 'sector_description') {
    if (input.sectorId === undefined || !ctx.sectorIds.includes(input.sectorId)) {
      return { ok: false, error: `sector_description needs the id of one of this field's sectors: ${ctx.sectorIds.join(', ') || 'none'}.` };
    }
    const description = (input.description ?? '').trim();
    if (description.length < 20 || description.length > 800) {
      return { ok: false, error: 'The new description must be 20-800 characters.' };
    }
    return { ok: true, payload: { kind: 'sector_description', sectorId: input.sectorId, description } };
  }

  if (input.kind === 'b2c_design') return checkB2cDesign(input, ctx);

  const codes = [...new Set((input.audienceCodes ?? []).map((c) => c.trim().toUpperCase()))];
  const unknown = codes.filter((c) => !isAudienceSegmentCode(c));
  if (codes.length === 0) return { ok: false, error: 'audiences needs at least one segment code.' };
  if (unknown.length) return { ok: false, error: `Unknown audience codes: ${unknown.join(', ')}.` };
  const fresh = codes.filter((c) => !ctx.linkedCodes.includes(c));
  if (fresh.length === 0) return { ok: false, error: 'This field already links all of those groups.' };
  const note = (input.note ?? '').trim();
  return { ok: true, payload: { kind: 'audiences', codes: fresh, note: note ? note.slice(0, 500) : null } };
}

/** A decision on a pending proposal; a decided one cannot be decided again. */
export function decide(
  proposals: readonly Proposal[],
  id: string,
  status: 'approved' | 'rejected',
  extra: Partial<Proposal> = {},
): { ok: true; proposals: Proposal[] } | { ok: false; error: string } {
  const target = proposals.find((p) => p.id === id);
  if (!target) return { ok: false, error: 'That proposal is no longer here.' };
  if (target.status !== 'pending') return { ok: false, error: `That proposal was already ${target.status}.` };
  return {
    ok: true,
    proposals: proposals.map((p) => (p.id === id ? { ...p, ...extra, status, decidedAt: new Date().toISOString() } : p)),
  };
}
