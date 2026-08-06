import { createHash } from 'node:crypto';
import type { ExportBundle, ExportManifest, PortabilityDb, EntityKey } from './contracts';
import { EXPORTERS } from './exporters';

/**
 * The concept doc's `.aibmpkg` bundle is a zip of separate JSON files plus a
 * `usage/usage.csv`. Collapsed here into **one JSON document** instead of a
 * real zip archive — no zip/tar library is a dependency of this app, and
 * adding one purely to satisfy a packaging preference (vs. the actual
 * substance: structured, checksummed, redaction-aware per-entity data) was
 * judged not worth it for a v1. Every entity is still its own top-level key
 * under `entities`, and `usageCsv` is a real CSV string — the shape is
 * preserved, just not the container. See docs/15-data-portability.md.
 */

/** Deterministic key ordering so the checksum only changes when the data actually does. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function renderUsageCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => toCsvValue(row[c])).join(','));
  return lines.join('\n');
}

export async function buildExportBundle(db: PortabilityDb, teamId: string): Promise<ExportBundle> {
  const entities: Partial<Record<EntityKey, unknown[]>> = {};

  for (const exporter of EXPORTERS) {
    entities[exporter.key] = await exporter.exportTeam(db, teamId);
  }

  const contents: ExportManifest['contents'] = {};
  for (const [key, rows] of Object.entries(entities)) contents[key as EntityKey] = (rows as unknown[]).length;

  const redactedVersions = (entities.personaVersions as { instructionsRedacted?: boolean }[] | undefined) ?? [];
  const redactedCount = redactedVersions.filter((v) => v.instructionsRedacted).length;
  const redactions = redactedCount > 0
    ? [`persona_versions.system_prompt redacted for ${redactedCount} version(s) not authored by this team`]
    : [];

  const models = Array.from(new Set(
    ((entities.personaVersions as { model?: string | null; aiProvider?: string }[] | undefined) ?? [])
      .map((v) => v.model || v.aiProvider)
      .filter((v): v is string => Boolean(v)),
  ));
  const modules = [
    (entities.conversations as unknown[] | undefined)?.length ? 'group-chat' : null,
    (entities.crews as unknown[] | undefined)?.length ? 'crews' : null,
  ].filter((v): v is string => Boolean(v));

  // Excludes generatedAt deliberately — this is a content checksum, not a
  // "when was this file made" stamp, so it stays stable across re-exports
  // of unchanged data (the round-trip acceptance test in docs/15-data-portability.md relies on this).
  const checksum = createHash('sha256').update(JSON.stringify(canonicalize(entities))).digest('hex');

  const manifest: ExportManifest = {
    kind: 'team-export',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    teamId,
    contents,
    redactions,
    requires: { models, modules },
    checksum,
  };

  const usageCsv = renderUsageCsv((entities.usageEvents as Record<string, unknown>[] | undefined) ?? []);

  return { manifest, entities, usageCsv };
}
