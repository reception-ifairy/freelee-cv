'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  personas, personaVersions, personaCategories, categories, sectors, creditPacks, promptModifiers,
  posts, pages, menuItems, settings, users,
  PERSONALITY_TRAITS, type PersonaCapabilities, type PersonaPersonality, type PersonaBlueprint,
} from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getActiveKnowledgeSources } from '@/lib/knowledge/registry';
import { isGuardrailCode } from '@/lib/persona/guardrails';
import { isAudienceSegmentCode } from '@/lib/persona/audience-segments';
import { slugify, readingMinutes } from '@/lib/utils';
import { getPlatformTeamId } from '@/lib/teams';
import { isChatProvider } from '@/lib/ai/registry';
import { isChatLayoutKey } from '@/lib/chat/layouts';
import { isToolKey } from '@/lib/tools/catalog';
import type { ActionState } from './auth';

const riskLevelSchema = z.enum(['R0', 'R1', 'R2', 'R3']);
const narrativeFitSchema = z.enum(['low', 'medium', 'high', 'very_high']);
const commaList = (value: string | undefined) =>
  (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);

/* ------------------------------- Personas ------------------------------- */

const personaSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(255).optional(),
  description: z.string().trim().max(4000).optional(),
  expertise: z.string().trim().max(120).optional(),
  accentColor: z.string().trim().max(16).default('#6366f1'),
  systemPrompt: z.string().trim().min(20, 'The system prompt needs to be meaningful.'),
  welcomeMessage: z.string().trim().max(2000).optional(),
  // Image-generation providers (e.g. 'stability') are catalog/admin-config only
  // this phase — a persona can never actually be assigned one, see docs/21-image-engines.md.
  aiProvider: z.string().trim().min(1).refine(isChatProvider, 'Not a valid chat provider.'),
  model: z.string().trim().max(120).optional(),
  // '' means "follow the suggestion computed from category/audience" — stored as
  // NULL so the suggestion stays live as the taxonomy changes, rather than being
  // frozen at whatever it happened to be on the day the persona was saved.
  chatLayout: z.string().trim().optional(),
  modelTier: z.enum(['fast', 'balanced', 'advanced']).optional(),
  temperature: z.coerce.number().min(0).max(2),
  frequencyPenalty: z.coerce.number().min(-2).max(2).default(0),
  presencePenalty: z.coerce.number().min(-2).max(2).default(0),
  maxTokens: z.coerce.number().int().min(64).max(32000).optional(),
  historyMessages: z.coerce.number().int().min(1).max(30).default(8),
  audienceType: z.enum(['B2B', 'B2C', 'B2G']).optional(),
  knowledgeDomains: z.string().trim().optional(),
  creditsPerMessage: z.coerce.number().int().min(0).default(0),
  position: z.coerce.number().int().default(0),
  interactionStyle: z.enum(['formal', 'casual', 'enthusiastic', 'concise', 'socratic']).optional(),
  approachToUnknown: z.enum(['admit_ignorance', 'educated_guess', 'ask_clarifying']).optional(),
  promptTechnique: z.enum(['direct', 'chain_of_thought']).default('direct'),
  blueprintJson: z.string().trim().optional(),
});

/** Bumps a semver patch — '1.0.0' -> '1.0.1'. Falls back to '1.0.1' if unparseable. */
function nextPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return '1.0.1';
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/** HTML checkboxes submit "on" or nothing — never "false". */
function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on';
}

async function uniquePersonaSlug(name: string, ignoreId?: number): Promise<string> {
  const base = slugify(name) || `persona-${Date.now()}`;
  let candidate = base;

  for (let i = 2; i < 100; i++) {
    const [existing] = await db
      .select({ id: personas.id })
      .from(personas)
      .where(eq(personas.slug, candidate))
      .limit(1);

    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }

  return `${base}-${Date.now()}`;
}

export async function savePersonaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = personaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const data = parsed.data;

  // Async (a real DB read now, since sources are admin-managed data — see
  // docs/18-knowledge-sources.md), so resolved once here into a plain Set
  // rather than inline in the values object below, where a synchronous
  // .filter() can't await per-item.
  const validSourceKeys = new Set((await getActiveKnowledgeSources()).map((s) => s.key));

  let blueprint: PersonaBlueprint | null = null;
  if (data.blueprintJson) {
    try {
      blueprint = JSON.parse(data.blueprintJson) as PersonaBlueprint;
    } catch {
      return { error: 'The cognitive blueprint is not valid JSON.' };
    }
  }

  const personality: PersonaPersonality = {};
  for (const trait of PERSONALITY_TRAITS) {
    const value = Number(formData.get(`personality.${trait}`));
    if (Number.isFinite(value)) personality[trait] = Math.min(100, Math.max(0, Math.round(value)));
  }

  const capabilities: PersonaCapabilities = {};
  for (const key of [
    'vision', 'images', 'voiceIn', 'voiceOut', 'share', 'copy',
    'embed', 'suggestions', 'badwordFilter', 'tone', 'writing', 'output',
  ] as const) {
    capabilities[key] = checkbox(formData, `capabilities.${key}`);
  }

  // Identity/catalog — stays on `personas`. See docs/11-persona-versioning.md.
  const personaValues = {
    name: data.name,
    slug: data.slug?.trim() || (await uniquePersonaSlug(data.name, data.id)),
    tagline: data.tagline ?? null,
    description: data.description ?? null,
    expertise: data.expertise ?? null,
    accentColor: data.accentColor,
    creditsPerMessage: data.creditsPerMessage,
    isPremium: checkbox(formData, 'isPremium'),
    isFeatured: checkbox(formData, 'isFeatured'),
    isActive: checkbox(formData, 'isActive'),
    position: data.position,
    pinVersioning: checkbox(formData, 'pinVersioning'),
    updatedAt: new Date(),
  };

  // Prompt/model/parameter content — lives on persona_versions.
  const versionValues = {
    systemPrompt: data.systemPrompt,
    welcomeMessage: data.welcomeMessage ?? null,
    suggestions: formData.getAll('suggestions').map((v) => String(v).trim()).filter(Boolean),
    aiProvider: data.aiProvider,
    chatLayout: data.chatLayout && isChatLayoutKey(data.chatLayout) ? data.chatLayout : null,
    tools: formData.getAll('tools').map(String).filter(isToolKey),
    // Server-enforced mutual exclusivity — a tier and an explicit model id
    // can't both be trusted, so the tier (when present) always wins and the
    // free-text model is discarded, regardless of what the form submitted.
    model: data.modelTier ? null : data.model || null,
    modelTier: data.modelTier ?? null,
    temperature: data.temperature,
    frequencyPenalty: data.frequencyPenalty,
    presencePenalty: data.presencePenalty,
    maxTokens: data.maxTokens ?? null,
    historyMessages: data.historyMessages,
    audienceType: data.audienceType ?? null,
    personality,
    knowledgeDomains: (data.knowledgeDomains ?? '').split(',').map((d) => d.trim()).filter(Boolean),
    groundingSources: formData.getAll('groundingSources').map(String).filter((key) => validSourceKeys.has(key)),
    guardrails: formData.getAll('guardrails').map(String).filter(isGuardrailCode),
    audienceSegments: formData.getAll('audienceSegments').map(String).filter(isAudienceSegmentCode),
    capabilities,
    interactionStyle: data.interactionStyle ?? null,
    approachToUnknown: data.approachToUnknown ?? null,
    promptTechnique: data.promptTechnique,
    thinkingMode: checkbox(formData, 'thinkingMode'),
    blueprint,
    updatedAt: new Date(),
  };

  // Every admin who reaches this action is a platform admin (requireAdmin()
  // above), and there's no per-team persona-creation surface yet (that's
  // Phase 2+) — so new personas are attributed to the platform team, same as
  // the 147 pre-teams personas. Editing an existing persona never touches
  // its teamId.
  let personaId: number;

  if (data.id) {
    const [existing] = await db.select().from(personas).where(eq(personas.id, data.id)).limit(1);
    if (!existing) return { error: 'Persona not found.' };

    await db.update(personas).set(personaValues).where(eq(personas.id, data.id));
    personaId = data.id;

    if (!existing.pinVersioning) {
      // Not opted into versioning: mutate the current version in place —
      // identical to how this app behaved before persona_versions existed.
      if (existing.currentVersionId) {
        await db.update(personaVersions).set(versionValues).where(eq(personaVersions.id, existing.currentVersionId));
      } else {
        // Defensive — shouldn't happen post-backfill, but a persona must
        // never end up with no current version.
        const [created] = await db
          .insert(personaVersions)
          .values({ personaId, version: '1.0.0', status: 'published', publishedAt: new Date(), ...versionValues })
          .returning({ id: personaVersions.id });
        await db.update(personas).set({ currentVersionId: created.id }).where(eq(personas.id, personaId));
      }
    } else if (existing.draftVersionId) {
      // Opted in, already has a draft in progress: keep editing that draft.
      await db.update(personaVersions).set(versionValues).where(eq(personaVersions.id, existing.draftVersionId));
    } else {
      // Opted in, no draft yet: start one (current version stays untouched
      // and, if already published, immutable).
      const [draft] = await db
        .insert(personaVersions)
        .values({ personaId, version: 'draft', status: 'draft', isImmutable: false, ...versionValues })
        .returning({ id: personaVersions.id });
      await db.update(personas).set({ draftVersionId: draft.id }).where(eq(personas.id, personaId));
    }
  } else {
    // New persona: insert identity row, then its first version, then point
    // currentVersionId at it — three statements, one transaction. No
    // deferred-FK trick needed (unlike Phase 1's teams<->users pair) because
    // currentVersionId is nullable by design here — see the schema comment
    // above `personas.currentVersionId` and docs/11-persona-versioning.md.
    const admin = await requireAdmin();

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(personas)
        .values({ ...personaValues, teamId: await getPlatformTeamId() })
        .returning({ id: personas.id });

      const [version] = await tx
        .insert(personaVersions)
        .values({
          personaId: created.id,
          version: '1.0.0',
          status: 'published',
          isImmutable: personaValues.pinVersioning,
          publishedAt: new Date(),
          createdBy: admin.id,
          ...versionValues,
        })
        .returning({ id: personaVersions.id });

      await tx.update(personas).set({ currentVersionId: version.id }).where(eq(personas.id, created.id));
      personaId = created.id;
    });
  }

  const saved = { id: personaId! };

  const categoryIds = formData
    .getAll('categoryIds')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  await db.delete(personaCategories).where(eq(personaCategories.personaId, saved.id));
  if (categoryIds.length > 0) {
    await db.insert(personaCategories).values(
      categoryIds.map((categoryId) => ({ personaId: saved.id, categoryId })),
    );
  }

  revalidatePath('/admin/personas');
  revalidatePath('/personas');
  redirect('/admin/personas');
}

export async function togglePersonaAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const field = z.enum(['isActive', 'isFeatured']).parse(formData.get('field'));

  await db
    .update(personas)
    .set(
      field === 'isActive'
        ? { isActive: sql`not ${personas.isActive}` }
        : { isFeatured: sql`not ${personas.isFeatured}` },
    )
    .where(eq(personas.id, id));

  revalidatePath('/admin/personas');
}

export async function deletePersonaAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(personas).where(eq(personas.id, id));
  revalidatePath('/admin/personas');
}

export async function duplicatePersonaAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [source] = await db.select().from(personas).where(eq(personas.id, id)).limit(1);
  if (!source) return;
  if (!source.currentVersionId) return; // shouldn't happen post-backfill

  const [sourceVersion] = await db
    .select()
    .from(personaVersions)
    .where(eq(personaVersions.id, source.currentVersionId))
    .limit(1);
  if (!sourceVersion) return;

  const {
    id: _id, createdAt: _createdAt, updatedAt: _updatedAt,
    currentVersionId: _currentVersionId, draftVersionId: _draftVersionId,
    chatsCount: _chatsCount, messagesCount: _messagesCount,
    ...restPersona
  } = source;
  const {
    id: _vId, personaId: _vPersonaId, createdAt: _vCreatedAt, updatedAt: _vUpdatedAt,
    version: _version, publishedAt: _publishedAt,
    ...restVersion
  } = sourceVersion;

  await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(personas)
      .values({
        ...restPersona,
        name: `${source.name} (copy)`,
        slug: await uniquePersonaSlug(`${source.name} copy`),
        isActive: false,
      })
      .returning({ id: personas.id });

    const [version] = await tx
      .insert(personaVersions)
      .values({
        ...restVersion,
        personaId: copy.id,
        version: '1.0.0',
        status: 'published',
        isImmutable: false,
        publishedAt: new Date(),
        createdBy: admin.id,
      })
      .returning({ id: personaVersions.id });

    await tx.update(personas).set({ currentVersionId: version.id }).where(eq(personas.id, copy.id));
  });

  revalidatePath('/admin/personas');
}

/** Publishes the current draft: snapshots it into an immutable version and makes it current. */
export async function publishPersonaVersionAction(formData: FormData) {
  const admin = await requireAdmin();
  const personaId = z.coerce.number().int().parse(formData.get('personaId'));
  const changelog = z.string().trim().max(500).optional().parse(formData.get('changelog') || undefined);

  const [persona] = await db.select().from(personas).where(eq(personas.id, personaId)).limit(1);
  if (!persona?.draftVersionId) return;

  const [currentVersion] = persona.currentVersionId
    ? await db.select({ version: personaVersions.version }).from(personaVersions).where(eq(personaVersions.id, persona.currentVersionId)).limit(1)
    : [undefined];

  await db
    .update(personaVersions)
    .set({
      version: nextPatchVersion(currentVersion?.version ?? '1.0.0'),
      status: 'published',
      isImmutable: true,
      changelog: changelog ?? null,
      createdBy: admin.id,
      publishedAt: new Date(),
    })
    .where(eq(personaVersions.id, persona.draftVersionId));

  await db
    .update(personas)
    .set({ currentVersionId: persona.draftVersionId, draftVersionId: null })
    .where(eq(personas.id, personaId));

  revalidatePath(`/admin/personas/${personaId}`);
}

/** Starts a fresh draft cloned from an old published version — rollback without erasing history. */
export async function revertPersonaVersionAction(formData: FormData) {
  await requireAdmin();
  const personaId = z.coerce.number().int().parse(formData.get('personaId'));
  const versionId = z.coerce.number().int().parse(formData.get('versionId'));

  const [source] = await db
    .select()
    .from(personaVersions)
    .where(and(eq(personaVersions.id, versionId), eq(personaVersions.personaId, personaId)))
    .limit(1);
  if (!source) return;

  const {
    id: _id, personaId: _personaId, createdAt: _createdAt, updatedAt: _updatedAt,
    version: _version, publishedAt: _publishedAt,
    ...content
  } = source;

  const [draft] = await db
    .insert(personaVersions)
    .values({ ...content, personaId, version: 'draft', status: 'draft', isImmutable: false })
    .returning({ id: personaVersions.id });

  await db.update(personas).set({ draftVersionId: draft.id }).where(eq(personas.id, personaId));

  revalidatePath(`/admin/personas/${personaId}`);
}

/* ------------------------------ Categories ------------------------------ */

const categorySchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  color: z.string().trim().max(16).default('#6366f1'),
  position: z.coerce.number().int().default(0),
  ukMarketSize: z.string().trim().max(100).optional(),
  ukGrowthRate: z.string().trim().max(50).optional(),
  ukKeyRegulations: z.string().trim().optional(),
  ukIndustryBodies: z.string().trim().optional(),
  defaultRiskLevel: riskLevelSchema.optional().or(z.literal('')),
  narrativePotential: narrativeFitSchema.optional().or(z.literal('')),
});

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const data = parsed.data;
  const values = {
    name: data.name,
    slug: slugify(data.name),
    description: data.description ?? null,
    color: data.color,
    position: data.position,
    isActive: checkbox(formData, 'isActive'),
    ukMarketSize: data.ukMarketSize || null,
    ukGrowthRate: data.ukGrowthRate || null,
    ukKeyRegulations: commaList(data.ukKeyRegulations),
    ukIndustryBodies: commaList(data.ukIndustryBodies),
    defaultRiskLevel: data.defaultRiskLevel || null,
    narrativePotential: data.narrativePotential || null,
  };

  if (data.id) await db.update(categories).set(values).where(eq(categories.id, data.id));
  else await db.insert(categories).values(values);

  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath('/admin/categories');
}

/* -------------------------------- Sectors -------------------------------- */

const sectorSchema = z.object({
  id: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int(),
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  b2cSuitability: z.coerce.number().int().min(0).max(100).default(50),
  b2bSuitability: z.coerce.number().int().min(0).max(100).default(50),
  b2gSuitability: z.coerce.number().int().min(0).max(100).default(50),
  typicalRiskLevel: riskLevelSchema.optional().or(z.literal('')),
  narrativeFit: narrativeFitSchema.optional().or(z.literal('')),
  position: z.coerce.number().int().default(0),
});

export async function saveSectorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = sectorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const data = parsed.data;
  const values = {
    categoryId: data.categoryId,
    name: data.name,
    slug: data.slug?.trim() || slugify(data.name),
    description: data.description ?? null,
    b2cSuitability: data.b2cSuitability,
    b2bSuitability: data.b2bSuitability,
    b2gSuitability: data.b2gSuitability,
    typicalRiskLevel: data.typicalRiskLevel || null,
    narrativeFit: data.narrativeFit || null,
    position: data.position,
    isActive: checkbox(formData, 'isActive'),
  };

  if (data.id) await db.update(sectors).set(values).where(eq(sectors.id, data.id));
  else await db.insert(sectors).values(values);

  revalidatePath('/admin/sectors');
  redirect('/admin/sectors');
}

export async function deleteSectorAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(sectors).where(eq(sectors.id, id));
  revalidatePath('/admin/sectors');
}

/* ------------------------------- Modifiers ------------------------------ */

export async function saveModifierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({
      id: z.coerce.number().int().optional(),
      type: z.enum(['tone', 'writing', 'output', 'length', 'audience']),
      name: z.string().trim().min(2).max(120),
      value: z.string().trim().min(3).max(1000),
      position: z.coerce.number().int().default(0),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const { id, ...rest } = parsed.data;
  const values = {
    ...rest,
    isActive: checkbox(formData, 'isActive'),
    isDefault: checkbox(formData, 'isDefault'),
  };

  // Only one default per type.
  if (values.isDefault) {
    await db.update(promptModifiers).set({ isDefault: false }).where(eq(promptModifiers.type, values.type));
  }

  if (id) await db.update(promptModifiers).set(values).where(eq(promptModifiers.id, id));
  else await db.insert(promptModifiers).values(values);

  revalidatePath('/admin/modifiers');
  return { success: 'Modifier saved.' };
}

export async function deleteModifierAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(promptModifiers).where(eq(promptModifiers.id, id));
  revalidatePath('/admin/modifiers');
}

/* ----------------------------- Credit packs ----------------------------- */

export async function savePackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({
      id: z.coerce.number().int().optional(),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(1000).optional(),
      price: z.coerce.number().min(0),
      compareAtPrice: z.coerce.number().min(0).optional(),
      currency: z.string().trim().length(3).default('USD'),
      credits: z.coerce.number().int().min(1),
      bonusCredits: z.coerce.number().int().min(0).default(0),
      badge: z.string().trim().max(60).optional(),
      tier: z.coerce.number().int().min(1).max(5).default(1),
      position: z.coerce.number().int().default(0),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const d = parsed.data;
  const values = {
    name: d.name,
    slug: slugify(d.name),
    description: d.description ?? null,
    features: formData.getAll('features').map((v) => String(v).trim()).filter(Boolean),
    // Round at the boundary — money never lives as a float in the database.
    priceCents: Math.round(d.price * 100),
    compareAtCents: d.compareAtPrice ? Math.round(d.compareAtPrice * 100) : null,
    currency: d.currency.toUpperCase(),
    credits: d.credits,
    bonusCredits: d.bonusCredits,
    badge: d.badge || null,
    tier: d.tier,
    position: d.position,
    isActive: checkbox(formData, 'isActive'),
    isFeatured: checkbox(formData, 'isFeatured'),
  };

  if (d.id) await db.update(creditPacks).set(values).where(eq(creditPacks.id, d.id));
  else await db.insert(creditPacks).values(values);

  revalidatePath('/admin/packs');
  revalidatePath('/pricing');
  redirect('/admin/packs');
}

export async function deletePackAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(creditPacks).where(eq(creditPacks.id, id));
  revalidatePath('/admin/packs');
}

/* --------------------------------- CMS ---------------------------------- */

export async function savePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = z
    .object({
      id: z.coerce.number().int().optional(),
      title: z.string().trim().min(3).max(200),
      slug: z.string().trim().max(200).optional(),
      excerpt: z.string().trim().max(500).optional(),
      content: z.string().trim().min(1),
      metaTitle: z.string().trim().max(120).optional(),
      metaDescription: z.string().trim().max(300).optional(),
      categoryId: z.coerce.number().int().optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const d = parsed.data;
  const isPublished = checkbox(formData, 'isPublished');

  const values = {
    authorId: admin.id,
    categoryId: d.categoryId ?? null,
    title: d.title,
    slug: d.slug?.trim() || slugify(d.title),
    excerpt: d.excerpt ?? null,
    content: d.content,
    metaTitle: d.metaTitle ?? null,
    metaDescription: d.metaDescription ?? null,
    isPublished,
    isFeatured: checkbox(formData, 'isFeatured'),
    publishedAt: isPublished ? new Date() : null,
    readingMinutes: readingMinutes(d.content),
    updatedAt: new Date(),
  };

  if (d.id) await db.update(posts).set(values).where(eq(posts.id, d.id));
  else await db.insert(posts).values(values);

  revalidatePath('/admin/posts');
  revalidatePath('/blog');
  redirect('/admin/posts');
}

export async function deletePostAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath('/admin/posts');
}

export async function savePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({
      id: z.coerce.number().int().optional(),
      title: z.string().trim().min(2).max(200),
      slug: z.string().trim().max(200).optional(),
      content: z.string().default(''),
      metaTitle: z.string().trim().max(120).optional(),
      metaDescription: z.string().trim().max(300).optional(),
      position: z.coerce.number().int().default(0),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const d = parsed.data;
  const values = {
    title: d.title,
    slug: d.slug?.trim() || slugify(d.title),
    content: d.content,
    metaTitle: d.metaTitle ?? null,
    metaDescription: d.metaDescription ?? null,
    isPublished: checkbox(formData, 'isPublished'),
    noindex: checkbox(formData, 'noindex'),
    position: d.position,
    updatedAt: new Date(),
  };

  if (d.id) await db.update(pages).set(values).where(eq(pages.id, d.id));
  else await db.insert(pages).values(values);

  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}

export async function deletePageAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page || page.isLocked) return;

  await db.delete(pages).where(eq(pages.id, id));
  revalidatePath('/admin/pages');
}

export async function saveMenuItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({
      id: z.coerce.number().int().optional(),
      location: z.enum(['header', 'footer', 'legal']),
      label: z.string().trim().min(1).max(60),
      href: z.string().trim().min(1).max(500),
      visibleTo: z.enum(['all', 'guest', 'auth', 'admin']).default('all'),
      position: z.coerce.number().int().default(0),
      // '' is what an unselected dropdown submits; Number('') is 0, which would
      // be a bogus foreign key — so filter the raw string before coercing.
      parentId: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()),
      icon: z.string().trim().max(40).optional(),
      description: z.string().trim().max(160).optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const { id, parentId, icon, description, ...rest } = parsed.data;

  // Navigation nests one level, like blocks: a dropdown of dropdowns is a
  // usability problem, not a feature. Enforced here rather than only in the
  // form, since the form is just a suggestion to anyone crafting a request.
  let resolvedParent: number | null = parentId ?? null;
  if (resolvedParent !== null) {
    if (resolvedParent === id) return { error: 'An item cannot be its own parent.' };

    const [parent] = await db.select().from(menuItems).where(eq(menuItems.id, resolvedParent)).limit(1);
    if (!parent) return { error: 'That parent item no longer exists.' };
    if (parent.parentId !== null) return { error: 'Menus only nest one level deep.' };
    if (parent.location !== rest.location) return { error: 'A parent must be in the same menu location.' };

    if (id) {
      const [child] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.parentId, id)).limit(1);
      if (child) return { error: 'This item already has items under it, so it cannot be moved under another.' };
    }
  }

  const values = {
    ...rest,
    parentId: resolvedParent,
    icon: icon || null,
    description: description || null,
    openInNewTab: checkbox(formData, 'openInNewTab'),
    isActive: checkbox(formData, 'isActive'),
  };

  if (id) await db.update(menuItems).set(values).where(eq(menuItems.id, id));
  else await db.insert(menuItems).values(values);

  revalidatePath('/admin/menus');
  revalidatePath('/', 'layout');
  return { success: 'Menu updated.' };
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(menuItems).where(eq(menuItems.id, id));
  revalidatePath('/admin/menus');
  revalidatePath('/', 'layout');
}

/* ------------------------------- Settings ------------------------------- */

type SettingKind = (typeof settings.$inferInsert)['type'];

const SETTING_KINDS: readonly SettingKind[] = ['string', 'text', 'bool', 'int', 'float', 'json', 'secret'];

function isSettingKind(value: string | undefined): value is SettingKind {
  return value !== undefined && (SETTING_KINDS as readonly string[]).includes(value);
}

/**
 * Field names carry their type as `key:type`, so one generic handler covers
 * every settings screen without a per-field mapping.
 */
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const group = String(formData.get('__group') ?? 'general');
  const booleans = formData.getAll('__bool').map(String);

  for (const name of booleans) {
    await upsertSetting(name, checkbox(formData, `${name}:bool`) ? '1' : '0', 'bool', group);
  }

  for (const [key, raw] of formData.entries()) {
    if (key.startsWith('__') || typeof raw !== 'string') continue;

    const [name, kind] = key.split(':');
    if (!name || !kind || !isSettingKind(kind) || kind === 'bool') continue;

    // A blank secret means "keep the stored value" — never overwrite with "".
    if (kind === 'secret' && raw.trim() === '') continue;

    await upsertSetting(name, raw, kind, group);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { success: 'Settings saved.' };
}

async function upsertSetting(key: string, value: string, type: SettingKind, group: string) {
  await db
    .insert(settings)
    .values({ key, value, type, group })
    .onConflictDoUpdate({ target: settings.key, set: { value, type, group } });
}

/* ------------------------------- Customers ------------------------------ */

export async function toggleUserActiveAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));

  await db.update(users).set({ isActive: sql`not ${users.isActive}` }).where(eq(users.id, id));
  revalidatePath('/admin/customers');
}

export async function toggleUserAdminAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));

  await db.update(users).set({ isAdmin: sql`not ${users.isAdmin}` }).where(eq(users.id, id));
  revalidatePath(`/admin/customers/${id}`);
}
