/**
 * Resumable, checkpointed migration of the legacy MySQL `prompts` dump.
 *
 * The default mode is a read-only dry run. AI preparation and database writes
 * are separate on purpose: production is not cleared until all 122 converted
 * characters have already passed validation.
 *
 * See docs/50-legacy-persona-import.md and `--help`.
 */
import 'dotenv/config';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../src/db';
import {
  categories,
  categoryAudienceSegments,
  chats,
  conversations,
  creditLedger,
  creditTransactions,
  creditWallets,
  crews,
  jobs,
  personaCategories,
  personas,
  personaVersions,
  projects,
  sectors,
  teams,
  usageEvents,
  users,
} from '../src/db/schema';
import { GUARDRAILS } from '../src/lib/persona/guardrails';
import {
  convertLegacyCharacterToPersona,
  legacyConvertedPersonaSchema,
  type PersonaTaxonomyOption,
} from '../src/lib/persona/convert';
import {
  legacyCapabilities,
  legacyCharacterDocument,
  legacyNumber,
  legacyString,
  parseLegacyPromptDump,
  type LegacyParseResult,
  type LegacyPromptCharacter,
} from '../src/lib/persona/legacy-source';

const DEFAULT_SOURCE = '/var/www/freelee.cv/personattest.json';
const DEFAULT_CHECKPOINT = '/var/backups/freelee-persona-import/personattest.checkpoint.json';
const EXPECTED = { rows: 126, characters: 122, active: 87, inactive: 35, duplicates: 4, categories: 20, sectors: 103 };

const checkpointEntrySchema = z.object({
  sourceKey: z.string(),
  sourceName: z.string(),
  sourceSlug: z.string(),
  sourceStatus: z.union([z.literal(0), z.literal(1)]),
  sourceIndex: z.number().int().min(0),
  sourceRefs: z.array(z.object({ block: z.number().int(), line: z.number().int(), id: z.number().int() })),
  persona: legacyConvertedPersonaSchema,
  provider: z.string(),
  model: z.string(),
  convertedAt: z.string().datetime(),
});

const checkpointSchema = z.object({
  version: z.literal(1),
  sourcePath: z.string(),
  sourceSha256: z.string().length(64),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  entries: z.array(checkpointEntrySchema),
});

type Checkpoint = z.infer<typeof checkpointSchema>;
type CheckpointEntry = z.infer<typeof checkpointEntrySchema>;

type Taxonomy = {
  options: PersonaTaxonomyOption[];
  categories: Map<string, typeof categories.$inferSelect>;
  sectors: Map<string, typeof sectors.$inferSelect>;
  audiences: Map<number, string[]>;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function usage(): string {
  return `Legacy Freelee persona import

Usage:
  npm run personas:import-legacy -- [mode] [options]

Modes (choose one):
  --prepare          Convert and classify characters with Google Gemini; no DB writes
  --dry-run          Validate source, checkpoint, taxonomy and cleanup baseline (default)
  --apply            Atomically purge tests and import; requires --purge-existing

Options:
  --source=<path>       Source dump (default: ${DEFAULT_SOURCE})
  --checkpoint=<path>   Private checkpoint (default: ${DEFAULT_CHECKPOINT})
  --resume              Continue an interrupted --prepare without repeating completed calls
  --purge-existing      Mandatory acknowledgement for --apply
  --help                Show this help

Safe workflow:
  npm run personas:import-legacy -- --prepare
  npm run personas:import-legacy -- --dry-run
  npm run personas:import-legacy -- --apply --purge-existing

Set DOTENV_CONFIG_PATH=.env.local when invoking the script outside the npm command.`;
}

function assertSourceProfile(parsed: LegacyParseResult): void {
  const active = parsed.characters.filter((row) => legacyNumber(row, 'status') === 1).length;
  const inactive = parsed.characters.length - active;
  const values = {
    rows: parsed.rows.length,
    characters: parsed.characters.length,
    active,
    inactive,
    duplicates: parsed.duplicateGroups.length,
  };
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (!(key in values)) continue;
    const actual = values[key as keyof typeof values];
    if (actual !== expected) throw new Error(`Source profile changed: expected ${key}=${expected}, got ${actual}.`);
  }
}

async function loadSource(path: string): Promise<{ text: string; parsed: LegacyParseResult }> {
  const text = await readFile(path, 'utf8');
  const parsed = parseLegacyPromptDump(text);
  assertSourceProfile(parsed);
  return { text, parsed };
}

async function loadTaxonomy(): Promise<Taxonomy> {
  const [categoryRows, sectorRows, audienceRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.id)),
    db.select().from(sectors).orderBy(asc(sectors.position), asc(sectors.id)),
    db.select().from(categoryAudienceSegments).orderBy(asc(categoryAudienceSegments.position)),
  ]);
  if (categoryRows.length !== EXPECTED.categories || sectorRows.length !== EXPECTED.sectors) {
    throw new Error(`Taxonomy changed: expected 20 categories/103 sectors, got ${categoryRows.length}/${sectorRows.length}.`);
  }

  const categoryMap = new Map(categoryRows.map((row) => [row.slug, row]));
  // Sector slugs are unique within a category, not globally: for example
  // social-media-marketing exists under two different categories.
  const sectorMap = new Map(sectorRows.map((row) => [`${row.categoryId}:${row.slug}`, row]));
  const audiences = new Map<number, string[]>();
  for (const row of audienceRows) {
    audiences.set(row.categoryId, [...(audiences.get(row.categoryId) ?? []), row.segmentCode]);
  }

  return {
    categories: categoryMap,
    sectors: sectorMap,
    audiences,
    options: categoryRows.map((category) => ({
      slug: category.slug,
      name: category.name,
      description: category.description,
      sectors: sectorRows
        .filter((sector) => sector.categoryId === category.id)
        .map((sector) => ({ slug: sector.slug, name: sector.name, description: sector.description })),
    })),
  };
}

function validateClassification(entry: CheckpointEntry, taxonomy: Taxonomy): void {
  const category = taxonomy.categories.get(entry.persona.categorySlug);
  if (!category) throw new Error(`${entry.sourceKey}: unknown category ${entry.persona.categorySlug}.`);
  const sector = taxonomy.sectors.get(`${category.id}:${entry.persona.sectorSlug}`);
  if (!sector) throw new Error(`${entry.sourceKey}: unknown sector ${entry.persona.sectorSlug}.`);
  if (sector.categoryId !== category.id) {
    throw new Error(`${entry.sourceKey}: sector ${sector.slug} does not belong to category ${category.slug}.`);
  }
}

function characterByKey(parsed: LegacyParseResult): Map<string, LegacyPromptCharacter> {
  return new Map(parsed.characters.map((character) => [character.sourceKey, character]));
}

async function readCheckpoint(path: string): Promise<Checkpoint> {
  return checkpointSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

async function persistCheckpoint(path: string, checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  checkpoint.updatedAt = new Date().toISOString();
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function writeReport(path: string, parsed: LegacyParseResult, checkpoint: Checkpoint): Promise<void> {
  const reportPath = path.replace(/\.json$/i, '.report.json');
  const categoryCounts: Record<string, number> = {};
  const lowConfidence: { sourceKey: string; confidence: number; reason: string }[] = [];
  for (const entry of checkpoint.entries) {
    categoryCounts[entry.persona.categorySlug] = (categoryCounts[entry.persona.categorySlug] ?? 0) + 1;
    if (entry.persona.taxonomyConfidence < 0.65) {
      lowConfidence.push({
        sourceKey: entry.sourceKey,
        confidence: entry.persona.taxonomyConfidence,
        reason: entry.persona.taxonomyReason,
      });
    }
  }
  await writeFile(reportPath, `${JSON.stringify({
    sourceSha256: parsed.sourceSha256,
    sourceRows: parsed.rows.length,
    characters: parsed.characters.length,
    active: parsed.characters.filter((row) => legacyNumber(row, 'status') === 1).length,
    inactive: parsed.characters.filter((row) => legacyNumber(row, 'status') === 0).length,
    duplicateGroups: parsed.duplicateGroups,
    categoryCounts,
    lowConfidence,
  }, null, 2)}\n`, { mode: 0o600 });
  await chmod(reportPath, 0o600);
}

async function validateCompleteCheckpoint(
  checkpoint: Checkpoint,
  sourcePath: string,
  parsed: LegacyParseResult,
  taxonomy: Taxonomy,
): Promise<void> {
  if (checkpoint.sourceSha256 !== parsed.sourceSha256) throw new Error('Checkpoint source checksum does not match the source file.');
  if (checkpoint.sourcePath !== sourcePath) throw new Error('Checkpoint source path does not match --source.');
  if (checkpoint.entries.length !== EXPECTED.characters) {
    throw new Error(`Checkpoint is incomplete: ${checkpoint.entries.length}/${EXPECTED.characters}. Run --prepare --resume.`);
  }

  const sources = characterByKey(parsed);
  const keys = new Set<string>();
  const slugs = new Set<string>();
  for (const entry of checkpoint.entries) {
    checkpointEntrySchema.parse(entry);
    const source = sources.get(entry.sourceKey);
    if (!source) throw new Error(`Checkpoint contains stale key ${entry.sourceKey}.`);
    if (keys.has(entry.sourceKey)) throw new Error(`Checkpoint repeats ${entry.sourceKey}.`);
    if (slugs.has(entry.sourceSlug)) throw new Error(`Checkpoint repeats slug ${entry.sourceSlug}.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.sourceSlug)) throw new Error(`Unsafe source slug ${entry.sourceSlug}.`);
    if (entry.sourceName !== legacyString(source, 'name')) throw new Error(`${entry.sourceKey}: source name drifted.`);
    if (entry.sourceStatus !== legacyNumber(source, 'status')) throw new Error(`${entry.sourceKey}: source status drifted.`);
    validateClassification(entry, taxonomy);
    keys.add(entry.sourceKey);
    slugs.add(entry.sourceSlug);
  }
}

async function prepare(sourcePath: string, checkpointPath: string, resume: boolean): Promise<void> {
  const { parsed } = await loadSource(sourcePath);
  const taxonomy = await loadTaxonomy();
  let checkpoint: Checkpoint;

  try {
    const existing = await readCheckpoint(checkpointPath);
    if (!resume) throw new Error(`Checkpoint already exists at ${checkpointPath}; use --resume or choose another path.`);
    if (existing.sourceSha256 !== parsed.sourceSha256 || existing.sourcePath !== sourcePath) {
      throw new Error('Existing checkpoint belongs to a different source file.');
    }
    checkpoint = existing;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOENT') throw error;
    const now = new Date().toISOString();
    checkpoint = { version: 1, sourcePath, sourceSha256: parsed.sourceSha256, createdAt: now, updatedAt: now, entries: [] };
  }

  const completed = new Set(checkpoint.entries.map((entry) => entry.sourceKey));
  for (const [sourceIndex, character] of parsed.characters.entries()) {
    if (completed.has(character.sourceKey)) {
      process.stdout.write(`[${sourceIndex + 1}/${EXPECTED.characters}] resume: ${legacyString(character, 'name')}\n`);
      continue;
    }

    const sourceName = legacyString(character, 'name');
    let entry: CheckpointEntry | null = null;
    let lastError = 'unknown conversion error';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await convertLegacyCharacterToPersona(
        legacyCharacterDocument(character),
        sourceName,
        taxonomy.options,
      );
      if (!result.ok) {
        lastError = result.error;
      } else {
        const candidate = checkpointEntrySchema.parse({
          sourceKey: character.sourceKey,
          sourceName,
          sourceSlug: legacyString(character, 'slug').toLocaleLowerCase('en'),
          sourceStatus: legacyNumber(character, 'status'),
          sourceIndex,
          sourceRefs: character.sourceRefs,
          persona: { ...result.persona, name: sourceName },
          provider: result.provider,
          model: result.model,
          convertedAt: new Date().toISOString(),
        });
        try {
          validateClassification(candidate, taxonomy);
          entry = candidate;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }

    if (!entry) throw new Error(`${character.sourceKey} failed after 3 attempts: ${lastError}`);
    checkpoint.entries.push(entry);
    await persistCheckpoint(checkpointPath, checkpoint);
    process.stdout.write(
      `[${sourceIndex + 1}/${EXPECTED.characters}] ${sourceName} -> ${entry.persona.categorySlug}/${entry.persona.sectorSlug} (${entry.persona.taxonomyConfidence.toFixed(2)})\n`,
    );
  }

  await validateCompleteCheckpoint(checkpoint, sourcePath, parsed, taxonomy);
  await writeReport(checkpointPath, parsed, checkpoint);
  process.stdout.write(`Prepared ${checkpoint.entries.length} characters in ${checkpointPath}. Database unchanged.\n`);
}

const CLEANUP_BASELINE = {
  personas: 3,
  persona_versions: 3,
  chats: 12,
  messages: 50,
  conversations: 3,
  crews: 1,
  crew_members: 2,
  crew_runs: 2,
  crew_run_steps: 3,
  jobs: 2,
  projects: 1,
  usage_events: 46,
  platform_spend_transactions: 48,
  platform_spend_ledger: 2,
} as const;

async function databaseCounts(executor: typeof db, platformTeamId: string): Promise<Record<string, number>> {
  const rows = await executor.execute(sql`
    SELECT 'personas' key, count(*)::int value FROM personas
    UNION ALL SELECT 'persona_versions', count(*)::int FROM persona_versions
    UNION ALL SELECT 'chats', count(*)::int FROM chats
    UNION ALL SELECT 'messages', count(*)::int FROM messages
    UNION ALL SELECT 'conversations', count(*)::int FROM conversations
    UNION ALL SELECT 'crews', count(*)::int FROM crews
    UNION ALL SELECT 'crew_members', count(*)::int FROM crew_members
    UNION ALL SELECT 'crew_runs', count(*)::int FROM crew_runs
    UNION ALL SELECT 'crew_run_steps', count(*)::int FROM crew_run_steps
    UNION ALL SELECT 'jobs', count(*)::int FROM jobs
    UNION ALL SELECT 'projects', count(*)::int FROM projects
    UNION ALL SELECT 'usage_events', count(*)::int FROM usage_events
    UNION ALL SELECT 'platform_spend_transactions', count(*)::int FROM credit_transactions WHERE team_id = ${platformTeamId} AND type = 'spend'
    UNION ALL SELECT 'platform_spend_ledger', count(*)::int FROM credit_ledger WHERE team_id = ${platformTeamId} AND type = 'spend'
  `);
  return Object.fromEntries((rows as unknown as { key: string; value: number }[]).map((row) => [row.key, Number(row.value)]));
}

function assertCleanupBaseline(actual: Record<string, number>): void {
  for (const [key, expected] of Object.entries(CLEANUP_BASELINE)) {
    if (actual[key] !== expected) {
      throw new Error(`Cleanup baseline drifted: expected ${key}=${expected}, got ${actual[key] ?? 'missing'}. Re-audit before deleting.`);
    }
  }
}

async function platformIdentity(executor: typeof db): Promise<{ teamId: string; ownerId: string }> {
  const [platform] = await executor.select({ teamId: teams.id, ownerId: teams.ownerId }).from(teams).where(eq(teams.slug, 'platform')).limit(1);
  if (!platform) throw new Error('Platform team was not found.');
  const [owner] = await executor.select({ id: users.id, isAdmin: users.isAdmin }).from(users).where(eq(users.id, platform.ownerId)).limit(1);
  if (!owner?.isAdmin) throw new Error('Platform owner is not an admin.');
  return platform;
}

function audienceLean(categoryId: number, taxonomy: Taxonomy): 'B2B' | 'B2C' | 'B2G' {
  const relevant = [...taxonomy.sectors.values()].filter((sector) => sector.categoryId === categoryId);
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
  const b2c = mean(relevant.map((sector) => sector.b2cSuitability));
  const b2b = mean(relevant.map((sector) => sector.b2bSuitability));
  const b2g = mean(relevant.map((sector) => sector.b2gSuitability));
  return b2g >= b2b && b2g >= b2c ? 'B2G' : b2b >= b2c ? 'B2B' : 'B2C';
}

function mandatoryGuardrails(risk: 'R0' | 'R1' | 'R2' | 'R3' | null): string[] {
  return Object.values(GUARDRAILS)
    .filter((guardrail) => guardrail.isMandatory && (!risk || guardrail.appliesToRiskLevels.includes(risk)))
    .map((guardrail) => guardrail.code);
}

function sourceNumber(character: LegacyPromptCharacter, key: Parameters<typeof legacyNumber>[1], min: number, max: number): number {
  return Math.min(max, Math.max(min, legacyNumber(character, key)));
}

async function applyImport(
  checkpoint: Checkpoint,
  parsed: LegacyParseResult,
  taxonomy: Taxonomy,
): Promise<void> {
  const sourceMap = characterByKey(parsed);

  await db.transaction(async (tx) => {
    // The app is stopped before this command. This assertion prevents a stale
    // cleanup plan from deleting data created after the audit.
    const platform = await platformIdentity(tx as unknown as typeof db);
    assertCleanupBaseline(await databaseCounts(tx as unknown as typeof db, platform.teamId));
    const [onlyProject] = await tx.select({ slug: projects.slug }).from(projects).limit(2);
    if (onlyProject?.slug !== 'test') throw new Error('The cleanup project is no longer the audited `test` project.');

    await tx.delete(jobs);
    await tx.delete(crews); // cascades members, runs and run steps
    await tx.delete(conversations); // remaining playground/room records
    await tx.delete(projects);
    await tx.delete(usageEvents);
    await tx.delete(chats); // cascades direct messages
    await tx.delete(personas); // cascades versions and category links

    await tx.delete(creditTransactions).where(and(eq(creditTransactions.teamId, platform.teamId), eq(creditTransactions.type, 'spend')));
    await tx.delete(creditLedger).where(and(eq(creditLedger.teamId, platform.teamId), eq(creditLedger.type, 'spend')));

    const [walletTotals] = await tx
      .select({
        balance: sql<number>`coalesce(sum(${creditTransactions.amount}), 0)::bigint`,
        granted: sql<number>`coalesce(sum(case when ${creditTransactions.amount} > 0 then ${creditTransactions.amount} else 0 end), 0)::bigint`,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.teamId, platform.teamId));
    await tx
      .update(creditWallets)
      .set({
        balance: Number(walletTotals.balance),
        reserved: 0,
        lifetimeGranted: Number(walletTotals.granted),
        lifetimeSpent: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(creditWallets.ownerType, 'team'), eq(creditWallets.ownerId, platform.teamId)));

    const [legacyTotals] = await tx
      .select({
        balance: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int`,
        purchased: sql<number>`coalesce(sum(case when ${creditLedger.amount} > 0 then ${creditLedger.amount} else 0 end), 0)::int`,
      })
      .from(creditLedger)
      .where(eq(creditLedger.teamId, platform.teamId));
    await tx
      .update(users)
      .set({ credits: Number(legacyTotals.balance), lifetimePurchased: Number(legacyTotals.purchased), lifetimeSpent: 0 })
      .where(eq(users.id, platform.ownerId));

    for (const entry of checkpoint.entries.sort((a, b) => a.sourceIndex - b.sourceIndex)) {
      const source = sourceMap.get(entry.sourceKey);
      if (!source) throw new Error(`Source disappeared for ${entry.sourceKey}.`);
      const category = taxonomy.categories.get(entry.persona.categorySlug);
      const sector = category ? taxonomy.sectors.get(`${category.id}:${entry.persona.sectorSlug}`) : undefined;
      if (!category || !sector || sector.categoryId !== category.id) throw new Error(`Taxonomy drift for ${entry.sourceKey}.`);

      const [created] = await tx
        .insert(personas)
        .values({
          teamId: platform.teamId,
          visibility: 'public',
          name: entry.sourceName,
          slug: entry.sourceSlug,
          tagline: entry.persona.tagline ?? null,
          description: entry.persona.description ?? null,
          expertise: entry.persona.expertise ?? null,
          sectorId: sector.id,
          accentColor: category.color ?? '#6366f1',
          pinVersioning: true,
          creditsPerMessage: 0,
          isPremium: false,
          isFeatured: false,
          isActive: entry.sourceStatus === 1,
          position: entry.sourceIndex,
        })
        .returning({ id: personas.id });

      const audienceType = entry.persona.audienceType ?? audienceLean(category.id, taxonomy);
      const [version] = await tx
        .insert(personaVersions)
        .values({
          personaId: created.id,
          version: '1.0.0',
          status: 'published',
          isImmutable: true,
          systemPrompt: entry.persona.systemPrompt,
          welcomeMessage: entry.persona.welcomeMessage ?? null,
          suggestions: entry.persona.suggestions,
          aiProvider: 'openai',
          modelTier: 'balanced',
          temperature: sourceNumber(source, 'temperature', 0, 2),
          frequencyPenalty: sourceNumber(source, 'frequency_penalty', -2, 2),
          presencePenalty: sourceNumber(source, 'presence_penalty', -2, 2),
          historyMessages: Math.round(sourceNumber(source, 'array_message_history', 0, 50)),
          audienceType,
          personality: entry.persona.personality,
          knowledgeDomains: entry.persona.knowledgeDomains,
          capabilities: legacyCapabilities(source),
          audienceSegments: taxonomy.audiences.get(category.id) ?? [],
          guardrails: mandatoryGuardrails(category.defaultRiskLevel),
          blueprint: entry.persona.blueprint,
          interactionStyle: entry.persona.interactionStyle ?? null,
          approachToUnknown: entry.persona.approachToUnknown ?? null,
          promptTechnique: entry.persona.promptTechnique,
          createdBy: platform.ownerId,
          publishedAt: new Date(),
        })
        .returning({ id: personaVersions.id });

      await tx.update(personas).set({ currentVersionId: version.id }).where(eq(personas.id, created.id));
      await tx.insert(personaCategories).values({ personaId: created.id, categoryId: category.id });
    }

    const [personaTotal] = await tx.select({ value: count() }).from(personas);
    const [versionTotal] = await tx.select({ value: count() }).from(personaVersions);
    const [categoryTotal] = await tx.select({ value: count() }).from(personaCategories);
    const [activeTotal] = await tx.select({ value: count() }).from(personas).where(eq(personas.isActive, true));
    const invalid = await tx.execute(sql`
      SELECT count(*)::int value
      FROM personas p
      LEFT JOIN persona_versions pv ON pv.id = p.current_version_id
      LEFT JOIN persona_categories pc ON pc.persona_id = p.id
      LEFT JOIN sectors s ON s.id = p.sector_id
      WHERE pv.id IS NULL OR pc.persona_id IS NULL OR s.id IS NULL OR s.category_id <> pc.category_id
    `) as unknown as { value: number }[];
    if (
      Number(personaTotal.value) !== EXPECTED.characters ||
      Number(versionTotal.value) !== EXPECTED.characters ||
      Number(categoryTotal.value) !== EXPECTED.characters ||
      Number(activeTotal.value) !== EXPECTED.active ||
      Number(invalid[0]?.value ?? -1) !== 0
    ) {
      throw new Error('Post-import invariants failed; the transaction will roll back.');
    }
  });
}

async function dryRun(sourcePath: string, checkpointPath: string): Promise<void> {
  const { parsed } = await loadSource(sourcePath);
  const taxonomy = await loadTaxonomy();
  const checkpoint = await readCheckpoint(checkpointPath);
  await validateCompleteCheckpoint(checkpoint, sourcePath, parsed, taxonomy);
  const platform = await platformIdentity(db);
  const before = await databaseCounts(db, platform.teamId);
  assertCleanupBaseline(before);
  const after = await databaseCounts(db, platform.teamId);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Dry run changed database counts.');
  const low = checkpoint.entries.filter((entry) => entry.persona.taxonomyConfidence < 0.65).length;
  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    sourceRows: parsed.rows.length,
    characters: parsed.characters.length,
    active: EXPECTED.active,
    inactive: EXPECTED.inactive,
    taxonomy: { categories: taxonomy.categories.size, sectors: taxonomy.sectors.size },
    lowConfidenceClassifications: low,
    cleanupBaseline: before,
    databaseWrites: 0,
  }, null, 2)}\n`);
}

async function main(): Promise<void> {
  if (flag('help')) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const modes = [flag('prepare'), flag('dry-run'), flag('apply')].filter(Boolean).length;
  if (modes > 1) throw new Error('Choose exactly one of --prepare, --dry-run or --apply.');
  const sourcePath = arg('source') ?? DEFAULT_SOURCE;
  const checkpointPath = arg('checkpoint') ?? DEFAULT_CHECKPOINT;

  if (flag('prepare')) {
    await prepare(sourcePath, checkpointPath, flag('resume'));
    return;
  }
  if (flag('apply')) {
    if (!flag('purge-existing')) throw new Error('--apply requires the explicit --purge-existing acknowledgement.');
    const { parsed } = await loadSource(sourcePath);
    const taxonomy = await loadTaxonomy();
    const checkpoint = await readCheckpoint(checkpointPath);
    await validateCompleteCheckpoint(checkpoint, sourcePath, parsed, taxonomy);
    await applyImport(checkpoint, parsed, taxonomy);
    process.stdout.write('Applied: 122 personas imported and the audited test dataset removed atomically.\n');
    return;
  }
  await dryRun(sourcePath, checkpointPath);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
