import { and, eq } from 'drizzle-orm';
import { personas, personaVersions, crews, crewMembers, externalIdMap } from '@/db/schema';
import type { Importer, ImportOpts, ImportResult, PortabilityDb, EntityKey } from './contracts';

/**
 * Scoped down from the full 11-entity export: only `personas`,
 * `personaVersions`, `crews`, and `crewMembers` are importable. The rest —
 * conversations/chats and their messages — are exported (full transcripts,
 * real portability/backup value) but deliberately **not** re-importable in
 * this v1. They're historical records, not "install this capability" data
 * the way a persona or crew definition is; correctly remapping their
 * polymorphic participant references (`conversation_participants.participantId`
 * can point at either a user or a persona depending on `participantType`)
 * for comparatively low incremental value was judged not worth it for a
 * first version. `usageEvents` is excluded on different grounds — see
 * exporters.ts. Revisit if a real disaster-recovery or cross-instance
 * migration need shows up. See docs/15-data-portability.md.
 */

/**
 * Real `externalIdMap` rows first; falls back to `dryRunSeen` (see
 * contracts.ts) so a dry run's downstream importers can resolve an FK onto
 * a row an *earlier* importer in the same dry run reported it would insert
 * — without either of them writing anything. Caught by verification: an
 * earlier version of this function only checked the DB, so a dry run of a
 * fresh import always reported personaVersions as 100% "skipped" (unable to
 * resolve their owning persona), because personasImporter's own dry-run
 * branch never touched externalIdMap either. Both problems, one fix.
 */
async function resolveMapping(
  db: PortabilityDb, teamId: string, entityType: EntityKey, externalId: string, dryRunSeen?: Map<EntityKey, Set<string>>,
): Promise<string | undefined> {
  if (dryRunSeen?.get(entityType)?.has(externalId)) return externalId;

  const [existing] = await db
    .select({ localId: externalIdMap.localId })
    .from(externalIdMap)
    .where(
      and(
        eq(externalIdMap.teamId, teamId),
        eq(externalIdMap.entityType, entityType),
        eq(externalIdMap.externalId, externalId),
      ),
    )
    .limit(1);
  return existing?.localId;
}

function markSeen(dryRunSeen: Map<EntityKey, Set<string>> | undefined, entityType: EntityKey, externalId: string): void {
  if (!dryRunSeen) return;
  if (!dryRunSeen.has(entityType)) dryRunSeen.set(entityType, new Set());
  dryRunSeen.get(entityType)!.add(externalId);
}

async function recordMapping(
  db: PortabilityDb, teamId: string, entityType: EntityKey, externalId: string, localId: string,
): Promise<void> {
  await db.insert(externalIdMap).values({ teamId, entityType, externalId, localId });
}

async function uniqueSlug(db: PortabilityDb, base: string): Promise<string> {
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const [existing] = await db.select({ id: personas.id }).from(personas).where(eq(personas.slug, candidate)).limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

type PersonaRow = typeof personas.$inferSelect;

/**
 * Inserted with `currentVersionId`/`draftVersionId` left null — the same
 * "nullable pointer, linked after" pattern used everywhere else a persona
 * and its versions are created together (docs/11-persona-versioning.md),
 * because the imported personaVersions rows don't have local ids yet at
 * this point. `linkPersonaVersionPointers()` below closes the loop once
 * personaVersionsImporter has run.
 */
const personasImporter: Importer<PersonaRow> = {
  key: 'personas',
  async importRows(db, teamId, rows, { dryRun, dryRunSeen }: ImportOpts) {
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = String(row.id);
      if (await resolveMapping(db, teamId, 'personas', externalId, dryRunSeen)) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        markSeen(dryRunSeen, 'personas', externalId);
        inserted += 1;
        continue;
      }

      const { id, teamId: _sourceTeamId, currentVersionId, draftVersionId, slug, ...rest } = row;
      const [created] = await db
        .insert(personas)
        .values({ ...rest, teamId, slug: await uniqueSlug(db, slug) })
        .returning({ id: personas.id });

      await recordMapping(db, teamId, 'personas', externalId, String(created.id));
      inserted += 1;
    }

    return { inserted, skipped };
  },
};

type PersonaVersionRow = typeof personaVersions.$inferSelect & { instructionsRedacted?: boolean };

const personaVersionsImporter: Importer<PersonaVersionRow> = {
  key: 'personaVersions',
  async importRows(db, teamId, rows, { dryRun, dryRunSeen }: ImportOpts) {
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = String(row.id);
      if (await resolveMapping(db, teamId, 'personaVersions', externalId, dryRunSeen)) {
        skipped += 1;
        continue;
      }

      const localPersonaId = await resolveMapping(db, teamId, 'personas', String(row.personaId), dryRunSeen);
      if (!localPersonaId) {
        // The owning persona wasn't part of this import (partial bundle) — nothing sane to attach this version to.
        skipped += 1;
        continue;
      }
      if (dryRun) {
        markSeen(dryRunSeen, 'personaVersions', externalId);
        inserted += 1;
        continue;
      }

      const { id, personaId: _sourcePersonaId, instructionsRedacted, ...rest } = row;
      const [created] = await db
        .insert(personaVersions)
        .values({ ...rest, personaId: Number(localPersonaId) })
        .returning({ id: personaVersions.id });

      await recordMapping(db, teamId, 'personaVersions', externalId, String(created.id));
      inserted += 1;
    }

    return { inserted, skipped };
  },
};

/** Second half of the two-step persona link — see personasImporter's comment. Call after both persona importers have run. */
export async function linkPersonaVersionPointers(
  db: PortabilityDb, teamId: string, personaRows: PersonaRow[], dryRun: boolean,
): Promise<number> {
  if (dryRun) return 0; // nothing was actually written to link against — see resolveMapping's dryRunSeen for why counts still work upstream
  let linked = 0;

  for (const row of personaRows) {
    const localPersonaId = await resolveMapping(db, teamId, 'personas', String(row.id));
    if (!localPersonaId) continue;

    const localCurrentVersionId = row.currentVersionId
      ? await resolveMapping(db, teamId, 'personaVersions', String(row.currentVersionId))
      : undefined;
    const localDraftVersionId = row.draftVersionId
      ? await resolveMapping(db, teamId, 'personaVersions', String(row.draftVersionId))
      : undefined;
    if (!localCurrentVersionId && !localDraftVersionId) continue;

    await db
      .update(personas)
      .set({
        currentVersionId: localCurrentVersionId ? Number(localCurrentVersionId) : null,
        draftVersionId: localDraftVersionId ? Number(localDraftVersionId) : null,
      })
      .where(eq(personas.id, Number(localPersonaId)));
    linked += 1;
  }

  return linked;
}

type CrewRow = typeof crews.$inferSelect;

const crewsImporter: Importer<CrewRow> = {
  key: 'crews',
  async importRows(db, teamId, rows, { dryRun, dryRunSeen }: ImportOpts) {
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = String(row.id);
      if (await resolveMapping(db, teamId, 'crews', externalId, dryRunSeen)) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        markSeen(dryRunSeen, 'crews', externalId);
        inserted += 1;
        continue;
      }

      // createdBy is kept as-is, not remapped to the importing user — users
      // aren't part of the exportable entity set, and preserving the
      // original author's id (even across teams) is more honest than
      // silently reattributing authorship to whoever runs the import.
      const { id, teamId: _sourceTeamId, ...rest } = row;
      const [created] = await db
        .insert(crews)
        .values({ ...rest, teamId })
        .returning({ id: crews.id });

      await recordMapping(db, teamId, 'crews', externalId, String(created.id));
      inserted += 1;
    }

    return { inserted, skipped };
  },
};

type CrewMemberRow = typeof crewMembers.$inferSelect;

const crewMembersImporter: Importer<CrewMemberRow> = {
  key: 'crewMembers',
  async importRows(db, teamId, rows, { dryRun, dryRunSeen }: ImportOpts) {
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = String(row.id);
      if (await resolveMapping(db, teamId, 'crewMembers', externalId, dryRunSeen)) {
        skipped += 1;
        continue;
      }

      const localCrewId = await resolveMapping(db, teamId, 'crews', String(row.crewId), dryRunSeen);
      const localPersonaId = await resolveMapping(db, teamId, 'personas', String(row.personaId), dryRunSeen);
      if (!localCrewId || !localPersonaId) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        markSeen(dryRunSeen, 'crewMembers', externalId);
        inserted += 1;
        continue;
      }

      const { id, crewId: _sourceCrewId, personaId: _sourcePersonaId, ...rest } = row;
      const [created] = await db
        .insert(crewMembers)
        .values({ ...rest, crewId: localCrewId, personaId: Number(localPersonaId) })
        .returning({ id: crewMembers.id });

      await recordMapping(db, teamId, 'crewMembers', externalId, String(created.id));
      inserted += 1;
    }

    return { inserted, skipped };
  },
};

/** Import order matters — each entry depends on the ones before it having already been imported. */
export const IMPORTERS: Importer[] = [
  personasImporter as Importer, personaVersionsImporter as Importer, crewsImporter as Importer, crewMembersImporter as Importer,
];

export type { ImportResult };
