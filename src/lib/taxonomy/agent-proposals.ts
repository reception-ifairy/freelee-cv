import 'server-only';
import { z } from 'zod';
import { convertedPersonaSchema, type ConvertedPersona } from '@/lib/persona/convert';
import { isAudienceSegmentCode } from '@/lib/persona/audience-segments';

/**
 * What the category agent may propose, and how a proposal is checked before
 * it is shown (owner, 2026-11-16: "the agent proposes, I approve"). The agent
 * never writes to the catalogue: its one tool, `propose`, only puts a checked
 * proposal on the category's list; Approve runs the ordinary admin action.
 *
 * Three kinds:
 * - `bot` — a new specialist, created on approval as an inactive draft;
 * - `sector_description` — a better description for one of the field's sectors;
 * - `audiences` — audience groups to link to the field, with a note on why.
 */
export const PROPOSAL_KINDS = ['bot', 'sector_description', 'audiences'] as const;
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
    .describe('bot = a new specialist; sector_description = rewrite one sector description; audiences = link audience groups to this field.'),
  summary: z.string().min(5).max(300).describe('One sentence for the owner: what this changes and why.'),
  sectorId: z.number().int().optional().describe('bot: the sector to file it under (optional). sector_description: the sector to rewrite (required).'),
  description: z.string().optional().describe('sector_description only: the new description, 1-3 sentences.'),
  audienceCodes: z.array(z.string()).optional().describe('audiences only: segment codes such as B2C-CYP-08.'),
  note: z.string().optional().describe('audiences only: why these people matter to this field, in one or two sentences.'),
  persona: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'bot only: the persona as an object with name, tagline, description, expertise, systemPrompt, welcomeMessage, suggestions (max 4), knowledgeDomains, audienceType (B2B|B2C|B2G), interactionStyle, approachToUnknown, promptTechnique, personality (traits 0-100).',
    ),
});
export type ProposeInput = z.infer<typeof proposeInputSchema>;

export type ProposalPayload =
  | { kind: 'bot'; sectorId: number | null; persona: ConvertedPersona }
  | { kind: 'sector_description'; sectorId: number; description: string }
  | { kind: 'audiences'; codes: string[]; note: string | null };

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

/** What a proposal may refer to: this field's sectors and the audience groups it already links. */
export type ProposalContext = { sectorIds: number[]; linkedCodes: string[] };

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
    return { ok: true, payload: { kind: 'bot', sectorId: input.sectorId ?? null, persona: parsed.data } };
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
