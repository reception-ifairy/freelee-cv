'use server';

// Named admin-taxonomy.ts, not admin/taxonomy.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  categories, categoryAudienceSegments, categoryUseCases, conversations, conversationMessages, sectors,
  personas, personaVersions, personaCategories,
} from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { AUDIENCE_SEGMENTS, isAudienceSegmentCode } from '@/lib/persona/audience-segments';
import { uniquePersonaSlug } from '@/lib/persona/slug';
import { convertedPersonaSchema } from '@/lib/persona/convert';
import { categoryBrief } from '@/lib/taxonomy/brief';
import { categoryAgentModel, readThread, threadState, updateThread, type AgentThreadState } from '@/lib/taxonomy/category-agent';
import { decide, type Proposal } from '@/lib/taxonomy/agent-proposals';
import { afterDecision, updatePlanItem } from '@/lib/taxonomy/agent-plan';
import type { ActionState } from './auth';

/** Codes are validated against the TypeScript catalogue — there is no FK to check them. */
const audienceSchema = z.object({
  categoryId: z.coerce.number().int(),
  codes: z.array(z.string()).default([]),
});

export async function setCategoryAudiencesAction(categoryId: number, codes: string[]): Promise<ActionState> {
  await requireAdmin();
  const parsed = audienceSchema.safeParse({ categoryId, codes });
  if (!parsed.success) return { error: 'That request did not make sense.' };

  const valid = parsed.data.codes.filter(isAudienceSegmentCode);

  await db.transaction(async (tx) => {
    // Notes are the operator's own words and must survive a re-tick, so the
    // existing rows are read before the wholesale replace rather than after.
    const existing = await tx
      .select({ code: categoryAudienceSegments.segmentCode, note: categoryAudienceSegments.note })
      .from(categoryAudienceSegments)
      .where(eq(categoryAudienceSegments.categoryId, parsed.data.categoryId));
    const notes = new Map(existing.map((row) => [row.code, row.note]));

    await tx.delete(categoryAudienceSegments).where(eq(categoryAudienceSegments.categoryId, parsed.data.categoryId));
    if (valid.length > 0) {
      await tx.insert(categoryAudienceSegments).values(
        valid.map((code, index) => ({
          categoryId: parsed.data.categoryId,
          segmentCode: code,
          note: notes.get(code) ?? null,
          position: index,
        })),
      );
    }
  });

  revalidatePath(`/admin/taxonomy/${parsed.data.categoryId}`);
  // The taxonomy overview shows audience coverage too.
  revalidatePath('/admin/taxonomy');
  return { success: `${valid.length} audience${valid.length === 1 ? '' : 's'} attached to this field.` };
}

const noteSchema = z.object({
  categoryId: z.coerce.number().int(),
  code: z.string().refine(isAudienceSegmentCode),
  note: z.string().max(500).transform((v) => v.trim()),
});

/**
 * Why one audience matters to this field, in the operator's own words — the
 * note compiled into the field's brief beside the group. It existed in the
 * table since the workbench shipped but nothing could write it except a
 * migration; the workspace's Audiences tab edits it in place now.
 * An empty note clears it.
 */
export async function setCategoryAudienceNoteAction(categoryId: number, code: string, note: string): Promise<ActionState> {
  await requireAdmin();
  const parsed = noteSchema.safeParse({ categoryId, code, note });
  if (!parsed.success) return { error: 'Notes are up to 500 characters, for an audience this field has.' };

  const updated = await db
    .update(categoryAudienceSegments)
    .set({ note: parsed.data.note || null })
    .where(and(eq(categoryAudienceSegments.categoryId, parsed.data.categoryId), eq(categoryAudienceSegments.segmentCode, parsed.data.code)))
    .returning({ code: categoryAudienceSegments.segmentCode });
  if (updated.length === 0) return { error: 'This field no longer has that audience — reload the page.' };

  revalidatePath(`/admin/taxonomy/${parsed.data.categoryId}`);
  return { success: parsed.data.note ? 'Note saved.' : 'Note cleared.' };
}

/* ------------------------------- Workbench -------------------------------- */

/**
 * Open (or reopen) the design conversation for a category.
 *
 * Stored as a `conversations` row with `kind: 'playground'` — a value that has
 * existed in the enum since the group-chat module shipped, that `/admin/rooms`
 * already renders a badge for, and that **nothing has ever written**. It was
 * reserved for this.
 *
 * Deliberately not a `chats` row. Those are customer property: `assertChatAccess`
 * is an owner-id or guest-cookie match with no concept of an admin, an
 * admin-owned chat would appear in the customer `/chat` sidebar, and every turn
 * would bill a wallet.
 *
 * One conversation per category, reopened rather than recreated, so the thinking
 * accumulates instead of scattering across a dozen abandoned threads.
 */
export async function openWorkbenchAction(
  categoryId: number,
): Promise<{ conversationId: string; model: string; modelId: string } | { error: string; noKey?: boolean }> {
  const admin = await requireAdmin();

  // The agent runs on Anthropic from the owner's key; without one there is nothing to open.
  const { modelId, label, keyReady } = await categoryAgentModel();
  if (!keyReady) {
    return { error: 'The category agent runs on Anthropic and there is no Anthropic key yet.', noKey: true };
  }

  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) return { error: 'That category is no longer here.' };

  // Keyed by the category's id (in settings), not its title: renaming a category used to orphan its thread.
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.kind, 'playground'), sql`${conversations.settings}->>'categoryId' = ${String(category.id)}`))
    .limit(1);
  // Which model answers, said on screen.
  const model = `Anthropic · ${label}`;
  if (existing) return { conversationId: existing.id, model, modelId };

  const teamId = await getPlatformTeamId();
  const [created] = await db
    .insert(conversations)
    .values({
      teamId,
      kind: 'playground',
      title: workbenchTitle(category.name),
      createdBy: admin.id,
      visibility: 'private',
      settings: { categoryId: category.id },
    })
    .returning({ id: conversations.id });

  return { conversationId: created.id, model, modelId };
}

function workbenchTitle(categoryName: string): string {
  return `AI agent — ${categoryName}`;
}

export async function workbenchHistoryAction(conversationId: string) {
  await requireAdmin();
  return db
    .select({
      id: conversationMessages.id,
      authorType: conversationMessages.authorType,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.position));
}

/* ---------------------------- Build a draft ------------------------------- */

const draftSchema = z.object({
  categoryId: z.coerce.number().int(),
  sectorId: z.coerce.number().int().optional(),
  persona: z.string().min(2),
});

/**
 * Turn a design conversation into a real draft persona.
 *
 * Reuses `convertedPersonaSchema` — the vocabulary for "a persona described as
 * JSON" already exists, with its own validation and repair path, and inventing a
 * second one would mean two shapes to keep in step.
 *
 * Improves on the bot converter's import in the three places where the converter
 * deliberately guesses nothing and here we actually know:
 *
 * - the **category** is the page you are on, so `persona_categories` is written
 *   rather than cleared;
 * - the **sector** was chosen in the workbench, so `personas.sector_id` is
 *   written — the column has had no writer at all since it was added;
 * - the **audience** comes from the category's own links.
 *
 * Created inactive with `pinVersioning`, so it lands as a genuine draft version
 * rather than a published 1.0.0. That is what "prototype" ought to mean.
 */
export async function buildDraftFromWorkbenchAction(formData: FormData): Promise<ActionState & { personaId?: number }> {
  const admin = await requireAdmin();
  const parsed = draftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'That draft could not be read.' };

  let draft: z.infer<typeof convertedPersonaSchema>;
  try {
    draft = convertedPersonaSchema.parse(JSON.parse(parsed.data.persona));
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0] : null;
    return {
      error: issue
        ? `The design was incomplete: ${issue.path.join('.')} — ${issue.message}.`
        : 'The design could not be read as a persona.',
    };
  }

  const personaId = await createDraftPersona(admin.id, parsed.data.categoryId, parsed.data.sectorId ?? null, draft);
  if (personaId === null) return { error: 'That category is no longer here.' };

  revalidatePath('/admin', 'layout');
  return { success: `“${draft.name}” saved as a prototype.`, personaId };
}

/**
 * Creates a draft persona from a design, filed under its category (and sector)
 * — shared by the pasted-JSON path and the category agent's approved `bot`
 * proposals. Inactive, with `pinVersioning`, so it lands as a genuine draft
 * version; audience segments only of its own kind; the field's mandatory
 * safeguards. Returns null when the category is gone.
 */
async function createDraftPersona(
  adminId: string,
  categoryId: number,
  sectorId: number | null,
  draft: z.infer<typeof convertedPersonaSchema>,
  /** The groups the agent wrote the bot for; without them, the field's groups of the bot's type. */
  segments?: string[],
): Promise<number | null> {
  const brief = await categoryBrief(categoryId);
  if (!brief) return null;

  // The audience type the field actually leans towards, unless the design said
  // otherwise. Not a guess — it is the average of hand-scored sector suitability.
  const lean = brief.audienceLean;
  const leaning = lean.b2g >= lean.b2b && lean.b2g >= lean.b2c ? 'B2G' : lean.b2b >= lean.b2c ? 'B2B' : 'B2C';
  const audienceType = draft.audienceType ?? leaning;

  const teamId = await getPlatformTeamId();
  const personaId = await db.transaction(async (tx) => {
    const [persona] = await tx
      .insert(personas)
      .values({
        teamId,
        name: draft.name,
        slug: await uniquePersonaSlug(draft.name),
        tagline: draft.tagline ?? null,
        description: draft.description ?? null,
        expertise: draft.expertise ?? null,
        accentColor: brief.color ?? '#6366f1',
        creditsPerMessage: 0,
        // A prototype is not for sale and not on the shelf until you say so.
        isActive: false,
        sectorId,
        pinVersioning: true,
      })
      .returning({ id: personas.id });

    const [version] = await tx
      .insert(personaVersions)
      .values({
        personaId: persona.id,
        version: 'draft',
        status: 'draft',
        isImmutable: false,
        createdBy: adminId,
        systemPrompt: draft.systemPrompt,
        welcomeMessage: draft.welcomeMessage ?? null,
        suggestions: draft.suggestions,
        knowledgeDomains: draft.knowledgeDomains,
        audienceType,
        // Only the field's audiences of this persona's own kind (2026-11-14): a B2C tutor drafted in
        // Education used to inherit the schools and universities the field is also sold to.
        audienceSegments: (segments?.length ? segments : brief.audiences.map((a) => a.code)).filter((code) => AUDIENCE_SEGMENTS[code]?.audienceType === audienceType),
        guardrails: brief.guardrails.filter((g) => g.isMandatory).map((g) => g.code),
        interactionStyle: draft.interactionStyle ?? null,
        approachToUnknown: draft.approachToUnknown ?? null,
        promptTechnique: draft.promptTechnique,
        personality: draft.personality as never,
        blueprint: draft.blueprint as never,
      })
      .returning({ id: personaVersions.id });

    await tx.update(personas).set({ draftVersionId: version.id }).where(eq(personas.id, persona.id));
    await tx.insert(personaCategories).values({ personaId: persona.id, categoryId });

    return persona.id;
  });

  return personaId;
}

/* --------------------------- Category agent --------------------------- */

/** The agent thread's proposals and what it has cost so far. */
export async function agentStateAction(conversationId: string): Promise<AgentThreadState | { error: string }> {
  await requireAdmin();
  const settings = await readThread(conversationId);
  if (!settings) return { error: 'That agent thread is no longer here.' };
  const { modelId } = await categoryAgentModel();
  return threadState(settings, modelId);
}

/**
 * The owner's decision on one of the agent's proposals (owner, 2026-11-16:
 * "the agent proposes, I approve"). Approving runs the ordinary admin change —
 * a new bot is always an inactive draft — and records the outcome on the
 * proposal; rejecting only records it.
 */
export async function decideProposalAction(
  conversationId: string,
  proposalId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionState & { personaId?: number }> {
  const admin = await requireAdmin();
  const settings = await readThread(conversationId);
  const categoryId = settings?.categoryId;
  if (!settings || !categoryId) return { error: 'That agent thread is no longer here.' };
  const proposal = (settings.proposals ?? []).find((p: Proposal) => p.id === proposalId);
  if (!proposal) return { error: 'That proposal is no longer here.' };
  if (proposal.status !== 'pending') return { error: `That proposal was already ${proposal.status}.` };

  let personaId: number | undefined;
  if (decision === 'approved') {
    const payload = proposal.payload;
    if (payload.kind === 'bot') {
      const created = await createDraftPersona(admin.id, categoryId, payload.sectorId, payload.persona, payload.segments);
      if (created === null) return { error: 'That category is no longer here.' };
      personaId = created;
      // The everyday use this bot was drafted for is served now (a use case of another field is never touched).
      if (payload.useCaseId !== undefined) {
        await db
          .update(categoryUseCases)
          .set({ personaId: created })
          .where(and(eq(categoryUseCases.id, payload.useCaseId), eq(categoryUseCases.categoryId, categoryId)));
      }
    } else if (payload.kind === 'sector_description') {
      const updated = await db
        .update(sectors)
        .set({ description: payload.description })
        .where(and(eq(sectors.id, payload.sectorId), eq(sectors.categoryId, categoryId)))
        .returning({ id: sectors.id });
      if (updated.length === 0) return { error: 'That sector is no longer in this category.' };
    } else if (payload.kind === 'b2c_design') {
      // The B2C foundation: groups after the existing ones, each with its own
      // note; uses after the existing ones, a title already here skipped.
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ code: categoryAudienceSegments.segmentCode, position: categoryAudienceSegments.position })
          .from(categoryAudienceSegments)
          .where(eq(categoryAudienceSegments.categoryId, categoryId));
        const have = new Set(existing.map((e) => e.code));
        let position = existing.reduce((max, e) => Math.max(max, e.position), -1);
        const fresh = payload.groups.filter((g) => !have.has(g.code) && isAudienceSegmentCode(g.code));
        if (fresh.length) {
          await tx.insert(categoryAudienceSegments).values(fresh.map((g) => ({ categoryId, segmentCode: g.code, note: g.note, position: ++position })));
        }

        const uses = await tx
          .select({ title: categoryUseCases.title, position: categoryUseCases.position })
          .from(categoryUseCases)
          .where(eq(categoryUseCases.categoryId, categoryId));
        const titles = new Set(uses.map((u) => u.title.trim().toLowerCase()));
        const sectorIds = new Set(
          (await tx.select({ id: sectors.id }).from(sectors).where(eq(sectors.categoryId, categoryId))).map((s) => s.id),
        );
        let usePosition = uses.reduce((max, u) => Math.max(max, u.position), -1);
        const newUses = payload.useCases.filter((u) => !titles.has(u.title.trim().toLowerCase()));
        if (newUses.length) {
          await tx.insert(categoryUseCases).values(
            newUses.map((u) => ({
              categoryId,
              // A sector deleted since the proposal is dropped, not an error.
              sectorId: u.sectorId !== null && sectorIds.has(u.sectorId) ? u.sectorId : null,
              title: u.title,
              situation: u.situation,
              firstMessage: u.firstMessage,
              segmentCodes: u.segmentCodes.filter(isAudienceSegmentCode),
              budgetFriendly: u.budgetFriendly,
              position: ++usePosition,
            })),
          );
        }
      });
    } else {
      // New groups go after the existing ones, each with the agent's note.
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ code: categoryAudienceSegments.segmentCode, position: categoryAudienceSegments.position })
          .from(categoryAudienceSegments)
          .where(eq(categoryAudienceSegments.categoryId, categoryId));
        const have = new Set(existing.map((e) => e.code));
        let position = existing.reduce((max, e) => Math.max(max, e.position), -1);
        const fresh = payload.codes.filter((code) => !have.has(code) && isAudienceSegmentCode(code));
        if (fresh.length) {
          await tx.insert(categoryAudienceSegments).values(fresh.map((code) => ({ categoryId, segmentCode: code, note: payload.note, position: ++position })));
        }
      });
    }
  }

  const result = await updateThread(conversationId, (s) => {
    const next = decide(s.proposals ?? [], proposalId, decision, personaId ? { personaId } : {});
    // The plan item this bot drafts: drafted on approval, back to "todo" on rejection.
    return next.ok ? { ...s, proposals: next.proposals, plan: afterDecision(s.plan ?? [], proposalId, decision, personaId) } : s;
  });
  void result;

  revalidatePath('/admin/taxonomy');
  if (personaId) revalidatePath('/admin', 'layout');
  return {
    success: decision === 'rejected' ? 'Rejected.' : personaId ? 'Approved — the bot is saved as an inactive draft.' : 'Approved and applied.',
    personaId,
  };
}

/**
 * Skip a plan item, or bring a skipped one back (owner's own edit of the
 * plan; the agent reads the plan at the start of every turn).
 */
export async function setPlanItemStatusAction(conversationId: string, itemId: string, status: 'skipped' | 'todo'): Promise<ActionState> {
  await requireAdmin();
  const settings = await readThread(conversationId);
  if (!settings) return { error: 'That agent thread is no longer here.' };
  const item = (settings.plan ?? []).find((p) => p.id === itemId);
  if (!item) return { error: 'That plan item is no longer here.' };
  if (item.status === 'proposed' || item.status === 'drafted') return { error: `That item is already ${item.status}.` };
  await updateThread(conversationId, (s) => ({ ...s, plan: updatePlanItem(s.plan ?? [], itemId, { status }) }));
  return { success: status === 'skipped' ? 'Skipped.' : 'Back on the plan.' };
}
