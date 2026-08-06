/**
 * Data portability contracts — a near-direct translation of the mined
 * concept doc's `Exporter`/`Importer`/`SourceAdapter` PHP interfaces into
 * TypeScript, registered in a static array (src/lib/portability/registry.ts)
 * for the same reason the module registry is static: no runtime scanning.
 * See docs/15-data-portability.md.
 *
 * Deliberately **not** `import 'server-only'`, unlike almost every other
 * server-side lib file in this app. This code has to run in two contexts:
 * inside a Next.js server action/route (src/app/(app)/dashboard/team/export/
 * route.ts) AND inside a plain `tsx` script (scripts/export-bundle.ts,
 * scripts/import-bundle.ts) that never boots Next.js at all — the same
 * constraint that made every Phase 6/7 verification script avoid importing
 * `@/db` directly. The fix here is dependency injection: every function
 * takes its Drizzle client as a parameter instead of importing the guarded
 * `@/db` singleton, so each caller supplies whichever client fits its
 * context (see PortabilityDb below).
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';

export type PortabilityDb = PostgresJsDatabase<typeof schema>;

export type EntityKey =
  | 'team' | 'personas' | 'personaVersions' | 'crews' | 'crewMembers'
  | 'conversations' | 'conversationParticipants' | 'conversationMessages'
  | 'chats' | 'messages' | 'usageEvents';

export interface Exporter<Row = Record<string, unknown>> {
  key: EntityKey;
  exportTeam(db: PortabilityDb, teamId: string): Promise<Row[]>;
}

export type ImportResult = { inserted: number; skipped: number };

export type ImportOpts = {
  dryRun: boolean;
  /**
   * Dry-run-only, in-memory stand-in for `externalIdMap`: a dry run never
   * writes, so a downstream importer (e.g. personaVersions, which needs to
   * know the local id a just-"inserted" persona *would* get) can't resolve
   * its FK the normal way. Each importer records the external ids it would
   * have inserted here; downstream importers check it as a fallback when
   * the real `externalIdMap` table has no row yet. `undefined` outside a
   * dry run (import.ts only allocates it when `dryRun: true`).
   */
  dryRunSeen?: Map<EntityKey, Set<string>>;
};

export interface Importer<Row = Record<string, unknown>> {
  key: EntityKey;
  /** `dryRun: true` (the default everywhere this is called) reports what *would* happen without writing. */
  importRows(db: PortabilityDb, teamId: string, rows: Row[], opts: ImportOpts): Promise<ImportResult>;
}

export type ExportManifest = {
  kind: 'team-export';
  /** Bundle format version — bump if a breaking shape change is ever made to entities below. */
  version: '1.0';
  generatedAt: string;
  teamId: string;
  contents: Partial<Record<EntityKey, number>>;
  /** Human-readable notes on any redaction applied — empty until Phase 9's marketplace introduces installed (not authored) personas. See exporters.ts. */
  redactions: string[];
  requires: { models: string[]; modules: string[] };
  /** sha256 of the canonicalised `entities` object — stable across re-exports of unchanged data (excludes generatedAt deliberately, so it's actually useful as a "did anything change" check). */
  checksum: string;
};

export type ExportBundle = {
  manifest: ExportManifest;
  entities: Partial<Record<EntityKey, unknown[]>>;
  /** A real CSV string, not a separate file — see bundle.ts for why the concept doc's multi-file zip shape was collapsed to one JSON document. */
  usageCsv: string;
};

/**
 * Normalises an external/foreign bundle format into our own ExportBundle
 * shape before import. `generic-json` (this app's own export format,
 * round-tripped) is the only one implemented — see registry.ts for why
 * `chatgpt-export` is declared but deferred.
 */
export interface SourceAdapter {
  key: string;
  detect(raw: unknown): boolean;
  toExportBundle(raw: unknown): ExportBundle;
}
