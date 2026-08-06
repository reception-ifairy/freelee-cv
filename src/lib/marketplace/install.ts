import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  vendors, listings, listingInstalls, personas, personaVersions,
  type Listing, type ListingInstall,
} from '@/db/schema';
import { grantEntitlement } from '@/lib/billing/entitlements';
import { slugify } from '@/lib/utils';

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'persona';
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    const [existing] = await db.select({ id: personas.id }).from(personas).where(eq(personas.slug, candidate)).limit(1);
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export class ListingUnavailableError extends Error {}

/**
 * Clones the vendor's current published version into a brand-new persona
 * owned by the installing team, then grants a permanent `entitlements` row
 * (source: 'marketplace') recording the install. This is the first thing
 * in the whole app that sets `personaVersions.authoredByTeamId` to a team
 * other than the persona's own `teamId` — the exact condition
 * docs/15-data-portability.md's `redactSystemPrompt()` was written against
 * back in Phase 8 but could never actually trigger until now. See
 * docs/16-marketplace.md.
 *
 * Only `free` and `credit_markup` listings can be installed this way —
 * `one_off`/`subscription` need a real checkout (and, for a vendor payout
 * to ever leave the platform, a real Stripe Connect account) that this
 * phase deliberately didn't build; see docs/16-marketplace.md for why.
 */
export async function installListing(
  listingId: string, installingTeamId: string, installedByUserId: string,
): Promise<ListingInstall> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) throw new ListingUnavailableError('Listing not found.');
  if (listing.status !== 'approved') throw new ListingUnavailableError('This listing is not available.');
  if (listing.pricingModel !== 'free' && listing.pricingModel !== 'credit_markup') {
    throw new ListingUnavailableError('This listing requires a purchase flow that is not available yet.');
  }

  const [existing] = await db
    .select({ id: listingInstalls.id })
    .from(listingInstalls)
    .where(and(eq(listingInstalls.listingId, listingId), eq(listingInstalls.installingTeamId, installingTeamId)))
    .limit(1);
  if (existing) throw new ListingUnavailableError('Already installed.');

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, listing.vendorId)).limit(1);
  if (!vendor) throw new ListingUnavailableError('Vendor not found.');
  if (vendor.teamId === installingTeamId) throw new ListingUnavailableError('You cannot install your own listing.');

  const [sourcePersona] = await db.select().from(personas).where(eq(personas.id, listing.personaId)).limit(1);
  if (!sourcePersona?.currentVersionId) throw new ListingUnavailableError('This persona has no published version to install.');
  const [sourceVersion] = await db
    .select()
    .from(personaVersions)
    .where(eq(personaVersions.id, sourcePersona.currentVersionId))
    .limit(1);
  if (!sourceVersion) throw new ListingUnavailableError('This persona has no published version to install.');

  const installedPersonaId = await db.transaction(async (tx) => {
    // Only identity fields — name/avatar/etc — come from the persona row.
    // Everything content-bearing (systemPrompt, model, personality, ...) is
    // deprecated on `personas` since Phase 4 (docs/11-persona-versioning.md)
    // and comes from the version below instead.
    const [clone] = await tx
      .insert(personas)
      .values({
        teamId: installingTeamId,
        visibility: 'team',
        name: sourcePersona.name,
        slug: await uniqueSlug(sourcePersona.name),
        tagline: sourcePersona.tagline,
        description: sourcePersona.description,
        expertise: sourcePersona.expertise,
        avatar: sourcePersona.avatar,
        accentColor: sourcePersona.accentColor,
        pinVersioning: sourcePersona.pinVersioning,
        // isFeatured/isPremium/minPlanTier/creditsPerMessage are the
        // platform's own merchandising/gating concepts — an installed copy
        // starts clean, not inheriting the vendor's platform-catalog status.
      })
      .returning({ id: personas.id });

    const [clonedVersion] = await tx
      .insert(personaVersions)
      .values({
        personaId: clone.id,
        version: '1.0.0',
        status: 'published',
        isImmutable: true,
        systemPrompt: sourceVersion.systemPrompt,
        welcomeMessage: sourceVersion.welcomeMessage,
        suggestions: sourceVersion.suggestions,
        aiProvider: sourceVersion.aiProvider,
        model: sourceVersion.model,
        modelTier: sourceVersion.modelTier,
        temperature: sourceVersion.temperature,
        topP: sourceVersion.topP,
        frequencyPenalty: sourceVersion.frequencyPenalty,
        presencePenalty: sourceVersion.presencePenalty,
        maxTokens: sourceVersion.maxTokens,
        historyMessages: sourceVersion.historyMessages,
        audienceType: sourceVersion.audienceType,
        personality: sourceVersion.personality,
        knowledgeDomains: sourceVersion.knowledgeDomains,
        capabilities: sourceVersion.capabilities,
        groundingSources: sourceVersion.groundingSources,
        guardrails: sourceVersion.guardrails,
        audienceSegments: sourceVersion.audienceSegments,
        blueprint: sourceVersion.blueprint,
        interactionStyle: sourceVersion.interactionStyle,
        approachToUnknown: sourceVersion.approachToUnknown,
        promptTechnique: sourceVersion.promptTechnique,
        thinkingMode: sourceVersion.thinkingMode,
        publishedAt: new Date(),
        // The one field this whole install mechanic exists to set correctly.
        authoredByTeamId: vendor.teamId,
      })
      .returning({ id: personaVersions.id });

    await tx.update(personas).set({ currentVersionId: clonedVersion.id }).where(eq(personas.id, clone.id));

    return clone.id;
  });

  const entitlement = await grantEntitlement(installingTeamId, 'marketplace', 'persona', {
    userId: installedByUserId,
    sourceId: listingId,
    targetId: String(installedPersonaId),
  });

  const [install] = await db
    .insert(listingInstalls)
    .values({
      listingId,
      installingTeamId,
      installedPersonaId,
      entitlementId: entitlement.id,
      creditMarkupPctSnapshot: listing.pricingModel === 'credit_markup' ? listing.creditMarkupPct : null,
      installedBy: installedByUserId,
    })
    .returning();

  await db.update(listings).set({ installCount: sql`${listings.installCount} + 1` }).where(eq(listings.id, listingId));

  return install;
}

export type { Listing };
