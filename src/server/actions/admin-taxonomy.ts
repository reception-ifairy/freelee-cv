'use server';

// Named admin-taxonomy.ts, not admin/taxonomy.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  categories, categoryAudienceSegments, conversations, conversationMessages,
  personas, personaVersions, personaCategories,
} from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { isAudienceSegmentCode } from '@/lib/persona/audience-segments';
import { uniquePersonaSlug } from '@/lib/persona/slug';
import { convertedPersonaSchema } from '@/lib/persona/convert';
import { categoryBrief } from '@/lib/taxonomy/brief';
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
  return { success: `${valid.length} audience${valid.length === 1 ? '' : 's'} attached to this field.` };
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
export async function openWorkbenchAction(categoryId: number): Promise<{ conversationId: string } | { error: string }> {
  const admin = await requireAdmin();

  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) return { error: 'That category is no longer here.' };

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.kind, 'playground'), eq(conversations.title, workbenchTitle(category.name))))
    .limit(1);
  if (existing) return { conversationId: existing.id };

  const teamId = await getPlatformTeamId();
  const [created] = await db
    .insert(conversations)
    .values({
      teamId,
      kind: 'playground',
      title: workbenchTitle(category.name),
      createdBy: admin.id,
      visibility: 'private',
    })
    .returning({ id: conversations.id });

  return { conversationId: created.id };
}

function workbenchTitle(categoryName: string): string {
  return `Workbench — ${categoryName}`;
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

  const brief = await categoryBrief(parsed.data.categoryId);
  if (!brief) return { error: 'That category is no longer here.' };

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
        sectorId: parsed.data.sectorId ?? null,
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
        createdBy: admin.id,
        systemPrompt: draft.systemPrompt,
        welcomeMessage: draft.welcomeMessage ?? null,
        suggestions: draft.suggestions,
        knowledgeDomains: draft.knowledgeDomains,
        audienceType,
        audienceSegments: brief.audiences.map((a) => a.code),
        guardrails: brief.guardrails.filter((g) => g.isMandatory).map((g) => g.code),
        interactionStyle: draft.interactionStyle ?? null,
        approachToUnknown: draft.approachToUnknown ?? null,
        promptTechnique: draft.promptTechnique,
        personality: draft.personality as never,
        blueprint: draft.blueprint as never,
      })
      .returning({ id: personaVersions.id });

    await tx.update(personas).set({ draftVersionId: version.id }).where(eq(personas.id, persona.id));
    await tx.insert(personaCategories).values({ personaId: persona.id, categoryId: parsed.data.categoryId });

    return persona.id;
  });

  revalidatePath('/admin/taxonomy/prototypes');
  revalidatePath('/admin/personas');
  return { success: `“${draft.name}” saved as a prototype.`, personaId };
}
