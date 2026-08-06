import type { ExportBundle, ImportResult, PortabilityDb, EntityKey } from './contracts';
import { personas } from '@/db/schema';
import { IMPORTERS, linkPersonaVersionPointers } from './importers';

export type ImportSummary = Partial<Record<EntityKey, ImportResult>> & { personaVersionLinks?: number };

/**
 * Runs every registered importer in dependency order (personas ->
 * personaVersions -> crews -> crewMembers), then links each imported
 * persona's currentVersionId/draftVersionId now that the versions have
 * local ids. `dryRun: true` (the default for both the script and the
 * self-service route — see docs/15-data-portability.md) performs zero
 * writes: every importer's dry-run branch only counts what it *would* do.
 * `dryRun: false` wraps everything in one transaction — either the whole
 * bundle lands, or none of it does.
 */
export async function importBundle(
  db: PortabilityDb, teamId: string, bundle: ExportBundle, opts: { dryRun: boolean },
): Promise<ImportSummary> {
  // Only allocated for a dry run — see contracts.ts's ImportOpts.dryRunSeen
  // for why downstream importers need this to resolve FKs onto rows an
  // earlier importer in the same dry run reported it would insert.
  const dryRunSeen = opts.dryRun ? new Map() : undefined;

  const run = async (tx: PortabilityDb): Promise<ImportSummary> => {
    const summary: ImportSummary = {};

    for (const importer of IMPORTERS) {
      const rows = (bundle.entities[importer.key] as unknown[] | undefined) ?? [];
      summary[importer.key] = await importer.importRows(tx, teamId, rows as never[], { ...opts, dryRunSeen });
    }

    const personaRows = (bundle.entities.personas as (typeof personas.$inferSelect)[] | undefined) ?? [];
    summary.personaVersionLinks = await linkPersonaVersionPointers(tx, teamId, personaRows, opts.dryRun);

    return summary;
  };

  return opts.dryRun ? run(db) : db.transaction((tx) => run(tx as unknown as PortabilityDb));
}
