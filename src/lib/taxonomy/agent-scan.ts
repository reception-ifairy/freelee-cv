import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { personaCategories, personas, personaVersions } from '@/db/schema';
import { AUDIENCE_SEGMENTS, type AudienceSegmentConfig } from '@/lib/persona/audience-segments';
import { categoryBrief, type CategoryBrief } from './brief';

/**
 * The category agent's two scans (owner, 2026-11-16: "each agent can scan the
 * audiences and its category, then helps me one by one with the first bot
 * drafts"). Each is a read-only tool the agent calls before it recommends
 * anything; the result is prose with ids, written for the model.
 *
 * - `scanCategory` — the sectors with their B2C/B2B/B2G suitability and risk,
 *   the bots filed in each (live or not, their audience type and groups), and
 *   the gaps: sectors with no bot, sectors well suited to an audience type
 *   that no bot here serves.
 * - `scanAudiences` — the 70 audience groups (or one type of them): what each
 *   needs, its tone and how much a wrong answer costs, whether this field
 *   links it and why, and how many bots here and on the whole platform are
 *   for it.
 *
 * A bot's version is its live one, or its draft while it has none — the
 * agent's own drafts have only a draft.
 */

type BotRow = {
  id: number;
  name: string;
  tagline: string | null;
  isActive: boolean;
  sectorId: number | null;
  audienceType: string | null;
  segments: string[] | null;
};

const versionJoin = sql`${personaVersions.id} = coalesce(${personas.currentVersionId}, ${personas.draftVersionId})`;

export async function categoryBots(categoryId: number): Promise<BotRow[]> {
  return db
    .select({
      id: personas.id,
      name: personas.name,
      tagline: personas.tagline,
      isActive: personas.isActive,
      sectorId: personas.sectorId,
      audienceType: sql<string | null>`${personaVersions.audienceType}::text`,
      segments: personaVersions.audienceSegments,
    })
    .from(personaCategories)
    .innerJoin(personas, eq(personas.id, personaCategories.personaId))
    .leftJoin(personaVersions, versionJoin)
    .where(eq(personaCategories.categoryId, categoryId))
    .orderBy(sql`${personas.isActive} desc`, asc(personas.name));
}

const SUITED = 60;
const TYPES = ['B2C', 'B2B', 'B2G'] as const;

function segmentName(code: string): string {
  return AUDIENCE_SEGMENTS[code]?.name ?? code;
}

export async function scanCategory(categoryId: number): Promise<string | null> {
  const [brief, bots] = await Promise.all([categoryBrief(categoryId), categoryBots(categoryId)]);
  if (!brief) return null;
  return renderCategoryScan(brief, bots);
}

export function renderCategoryScan(brief: Pick<CategoryBrief, 'name' | 'riskLevel' | 'audienceLean' | 'sectors'>, bots: BotRow[]): string {
  const live = bots.filter((b) => b.isActive).length;
  const lines: string[] = [
    `# Scan of ${brief.name}`,
    `${bots.length} bot(s) filed here, ${live} live. Field risk: ${brief.riskLevel ?? 'unclassified'}. ` +
      `Lean of its sectors (0–100): consumers ${brief.audienceLean.b2c}, businesses ${brief.audienceLean.b2b}, public sector ${brief.audienceLean.b2g}.`,
    '',
    '## Sectors',
  ];

  const gaps: string[] = [];
  for (const s of brief.sectors) {
    const here = bots.filter((b) => b.sectorId === s.id);
    const types = new Set(here.map((b) => b.audienceType).filter(Boolean));
    const suit = { B2C: s.b2c, B2B: s.b2b, B2G: s.b2g };
    lines.push(
      `- id ${s.id} · ${s.name} · risk ${s.riskLevel ?? '—'} · suits B2C ${s.b2c} / B2B ${s.b2b} / B2G ${s.b2g} · ` +
        `${here.length} bot(s), ${here.filter((b) => b.isActive).length} live${here.length ? `: ${here.map((b) => b.name).join(', ')}` : ''}`,
    );
    if (here.length === 0) gaps.push(`${s.name} (id ${s.id}) has no bot at all.`);
    for (const type of TYPES) {
      if (suit[type] >= SUITED && here.length > 0 && !types.has(type)) gaps.push(`${s.name} suits ${type} (${suit[type]}) but no ${type} bot is filed there.`);
    }
  }

  lines.push('', '## Bots');
  if (bots.length === 0) lines.push('None yet.');
  for (const b of bots) {
    const sector = brief.sectors.find((s) => s.id === b.sectorId)?.name ?? 'no sector';
    const groups = (b.segments ?? []).map((c) => `${c} ${segmentName(c)}`).join(', ') || 'no groups';
    lines.push(`- id ${b.id} · ${b.name} · ${b.isActive ? 'live' : 'not live'} · ${sector} · ${b.audienceType ?? 'no audience type'} · for: ${groups}${b.tagline ? ` — ${b.tagline}` : ''}`);
  }
  const unfiled = bots.filter((b) => b.sectorId === null).length;
  if (unfiled) gaps.push(`${unfiled} bot(s) here have no sector.`);
  const notLive = bots.filter((b) => !b.isActive).length;
  if (notLive) gaps.push(`${notLive} bot(s) are not live — drafts to finish, or ones to drop.`);

  lines.push('', '## Gaps', ...(gaps.length ? gaps.map((g) => `- ${g}`) : ['- None found by the scan.']));
  return lines.join('\n');
}

export async function scanAudiences(categoryId: number, type?: 'B2C' | 'B2B' | 'B2G'): Promise<string | null> {
  const [brief, bots, platform] = await Promise.all([
    categoryBrief(categoryId),
    categoryBots(categoryId),
    // Every bot's groups, platform-wide: how crowded each group already is.
    db
      .select({ segments: personaVersions.audienceSegments, isActive: personas.isActive })
      .from(personas)
      .innerJoin(personaVersions, versionJoin),
  ]);
  if (!brief) return null;
  return renderAudienceScan(
    { name: brief.name, linked: brief.audiences.map((a) => ({ code: a.code, note: a.note })) },
    bots,
    platform.map((p) => p.segments ?? []),
    type,
  );
}

export function renderAudienceScan(
  field: { name: string; linked: { code: string; note: string | null }[] },
  bots: BotRow[],
  platformSegments: string[][],
  type?: 'B2C' | 'B2B' | 'B2G',
): string {
  const linked = new Map(field.linked.map((l) => [l.code, l.note]));
  const hereCount = (code: string) => bots.filter((b) => (b.segments ?? []).includes(code)).length;
  const platformCount = (code: string) => platformSegments.filter((s) => s.includes(code)).length;
  const segments = Object.values(AUDIENCE_SEGMENTS).filter((s) => !type || s.audienceType === type);

  const describe = (s: AudienceSegmentConfig) => {
    const ages = s.ageRangeMin !== undefined ? ` · aged ${s.ageRangeMin}${s.ageRangeMax !== undefined ? `–${s.ageRangeMax}` : '+'}` : '';
    const tone = s.preferredTone?.length ? ` · tone: ${s.preferredTone.join(', ')}` : '';
    const note = linked.get(s.code);
    const here = linked.has(s.code) ? `LINKED here${note ? ` (“${note}”)` : ''}` : 'not linked';
    return (
      `- ${s.code} · ${s.name}${ages} · needs: ${s.keyNeeds.slice(0, 5).join(', ').replace(/_/g, ' ')}${tone} · wrong answer: ${s.riskSensitivity.replace(/_/g, ' ')} · ` +
      `${here} · bots here: ${hereCount(s.code)} · on the platform: ${platformCount(s.code)}`
    );
  };

  const lines = [`# Audience scan for ${field.name}${type ? ` — ${type} groups only` : ''}`, ''];
  for (const t of TYPES) {
    const group = segments.filter((s) => s.audienceType === t);
    if (!group.length) continue;
    lines.push(`## ${t}`, ...group.map(describe), '');
  }

  const linkedUnserved = field.linked.filter((l) => hereCount(l.code) === 0).map((l) => `${l.code} ${segmentName(l.code)}`);
  const servedUnlinked = [...new Set(bots.flatMap((b) => b.segments ?? []))].filter((c) => !linked.has(c)).map((c) => `${c} ${segmentName(c)}`);
  lines.push(
    '## Summary',
    `- Linked to this field but no bot here is for them: ${linkedUnserved.join(', ') || 'none'}.`,
    `- Bots here are for these groups, which the field does not link: ${servedUnlinked.join(', ') || 'none'}.`,
  );
  return lines.join('\n');
}

/** One bot of this field in full, for a review; null when it is not filed here. */
export async function readBot(categoryId: number, personaId: number) {
  const [row] = await db
    .select({
      id: personas.id,
      name: personas.name,
      tagline: personas.tagline,
      description: personas.description,
      isActive: personas.isActive,
      audienceType: sql<string | null>`${personaVersions.audienceType}::text`,
      segments: personaVersions.audienceSegments,
      systemPrompt: personaVersions.systemPrompt,
      welcomeMessage: personaVersions.welcomeMessage,
    })
    .from(personaCategories)
    .innerJoin(personas, eq(personas.id, personaCategories.personaId))
    .leftJoin(personaVersions, versionJoin)
    .where(sql`${personaCategories.categoryId} = ${categoryId} and ${personas.id} = ${personaId}`)
    .limit(1);
  return row ?? null;
}
