'use server';

// Named admin-persona-convert.ts, not admin/persona-convert.ts —
// src/server/actions/admin.ts already exists as a file. Same collision
// workaround as admin-ai-models.ts.

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { personas, personaVersions, personaCategories, PERSONALITY_TRAITS } from '@/db/schema';
import type { PersonaPersonality } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { uniquePersonaSlug } from '@/lib/persona/slug';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractDocument, isSupportedDocument, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS } from '@/lib/documents/extract';
import { convertDocumentToPersona, convertedPersonaSchema } from '@/lib/persona/convert';
import type { ConvertedPersona } from '@/lib/persona/convert';

/**
 * The bot converter — admin only, in both senses that matter.
 *
 * `requireAdmin()` is the real gate (the `/admin` middleware and layout are
 * defence in depth, not the boundary). It matters more here than on most admin
 * screens: this action accepts an arbitrary file upload and spends real API
 * credit on every call, so an unauthenticated version would be both a parser
 * target and a way to run up a bill.
 */

export type ConversionState =
  | null
  | { error: string }
  | { persona: ConvertedPersona; provider: string; model: string; source: string };

export async function convertDocumentAction(
  _prev: ConversionState,
  formData: FormData,
): Promise<ConversionState> {
  const admin = await requireAdmin();

  // Rate limited despite being admin-only. One conversion is a large prompt
  // against the platform's best model; a stuck retry loop in a browser tab
  // would be an expensive afternoon. Keyed by admin so two admins never share
  // a bucket.
  const limit = checkRateLimit({
    name: 'persona-convert',
    key: admin.id,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) {
    return { error: `That is 20 conversions this hour — the limit resets in ${Math.ceil(limit.retryAfter / 60)} minutes.` };
  }

  const hint = String(formData.get('hint') ?? '').trim().slice(0, 500) || undefined;
  const mode = formData.get('mode') === 'paste' ? 'paste' : 'upload';

  try {
    if (mode === 'paste') {
      const text = String(formData.get('text') ?? '').trim();
      if (text.length < 40) return { error: 'Paste a little more — there is not enough here to build a character from.' };

      const name = String(formData.get('name') ?? '').trim() || 'Pasted description';
      const result = await convertDocumentToPersona(
        { mode: 'text', text: text.slice(0, 120_000), truncated: text.length > 120_000 },
        { filename: name, hint },
      );
      return result.ok
        ? { persona: result.persona, provider: result.provider, model: result.model, source: name }
        : { error: result.error };
    }

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file first.' };
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
    }
    // Checked on the server as well as in the picker: the `accept` attribute is
    // a convenience, not a constraint — a crafted POST ignores it entirely.
    if (!isSupportedDocument(file.name)) {
      return { error: `Unsupported file type. Accepted: ${SUPPORTED_EXTENSIONS.join(', ')}.` };
    }

    const extracted = await extractDocument(file.name, Buffer.from(await file.arrayBuffer()));
    const result = await convertDocumentToPersona(extracted, { filename: file.name, hint });
    return result.ok
      ? { persona: result.persona, provider: result.provider, model: result.model, source: file.name }
      : { error: result.error };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The conversion failed.' };
  }
}

/**
 * Creates the reviewed draft as a real persona and opens it in the editor.
 *
 * The JSON is re-validated here rather than trusted. It arrives from the
 * browser as a hidden field, which means it can be anything at all by the time
 * it comes back — and it ends up compiled into a system prompt that speaks to
 * customers.
 *
 * The persona is created **inactive**. A machine-extracted character must be
 * read by a human before it appears in the marketplace; publishing it straight
 * to the public catalogue would make an unreviewed model output the product.
 */
export async function importConvertedPersonaAction(formData: FormData) {
  const admin = await requireAdmin();

  const parsed = convertedPersonaSchema.safeParse(JSON.parse(String(formData.get('persona') ?? '{}')));
  if (!parsed.success) return;
  const draft = parsed.data;

  const personality: PersonaPersonality = {};
  for (const trait of PERSONALITY_TRAITS) {
    const value = draft.personality[trait];
    if (typeof value === 'number') personality[trait] = Math.round(value);
  }

  let personaId = 0;

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(personas)
      .values({
        name: draft.name,
        slug: await uniquePersonaSlug(draft.name),
        tagline: draft.tagline ?? null,
        description: draft.description ?? null,
        expertise: draft.expertise ?? null,
        accentColor: '#6366f1',
        creditsPerMessage: 0,
        isActive: false,
        teamId: await getPlatformTeamId(),
      })
      .returning({ id: personas.id });

    const [version] = await tx
      .insert(personaVersions)
      .values({
        personaId: created.id,
        version: '1.0.0',
        status: 'published',
        publishedAt: new Date(),
        createdBy: admin.id,
        systemPrompt: draft.systemPrompt,
        welcomeMessage: draft.welcomeMessage ?? null,
        suggestions: draft.suggestions,
        // The platform default rather than a model the document named: the
        // source file has no idea what this platform has keys for.
        aiProvider: 'openai',
        modelTier: 'balanced',
        knowledgeDomains: draft.knowledgeDomains,
        audienceType: draft.audienceType ?? null,
        interactionStyle: draft.interactionStyle ?? null,
        approachToUnknown: draft.approachToUnknown ?? null,
        promptTechnique: draft.promptTechnique,
        personality,
        blueprint: draft.blueprint,
      })
      .returning({ id: personaVersions.id });

    await tx.update(personas).set({ currentVersionId: version.id }).where(eq(personas.id, created.id));
    personaId = created.id;
  });

  // No categories are guessed. Category drives pricing, the marketplace filter
  // and the suggested toolset — a wrong guess there is worse than none, and
  // the editor asks for it on the very next screen.
  await db.delete(personaCategories).where(eq(personaCategories.personaId, personaId));

  revalidatePath('/admin/personas');
  redirect(`/admin/personas/${personaId}`);
}
