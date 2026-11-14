/**
 * The six markets ("pillars") the admin is organised by — owner decision,
 * 2026-11-14: "do not treat the two pillars as the only ones; propose more,
 * based on the audience".
 *
 * A pillar is not stored anywhere. It is worked out from who a bot serves:
 * every one of the 70 audience segments belongs to exactly one pillar (by its
 * family, with a few education segments pulled out of Business and Public
 * sector into Schools), and a bot or a category follows from its segments.
 * So when a bot's audience changes, its pillar follows; there is nothing to
 * keep in step and no migration.
 *
 * Plain module — no database — shared by the server pages, the client tree and
 * `scripts/verify-pillars.ts`.
 */
import { AUDIENCE_SEGMENTS, familyOf } from '@/lib/persona/audience-segments';

export type PillarId = 'business' | 'homeschooling' | 'schools' | 'adults' | 'interests' | 'public';
export type AudienceKind = 'B2C' | 'B2B' | 'B2G';

export type Pillar = {
  id: PillarId;
  label: string;
  /** One word, for chips and dots. */
  short: string;
  description: string;
  /** Live: it has an offering page and is sold now. Planned: designed for, not yet sold. */
  status: 'live' | 'planned';
  /** The public page that sells it (a CMS page slug), when there is one. */
  offeringSlug: string | null;
  /** The lowest risk level a field serving this pillar should carry. Null: none beyond the field's own. */
  riskFloor: 'R1' | 'R2' | null;
  /** One hue per pillar, the same in the tree, the badges and the dashboard. */
  color: string;
};

export const PILLARS: readonly Pillar[] = [
  {
    id: 'business',
    label: 'Business',
    short: 'Business',
    description: 'Firms of every size, industry and function: the B2B marketplace.',
    status: 'live',
    offeringSlug: 'business',
    riskFloor: null,
    color: '#38bdf8',
  },
  {
    id: 'homeschooling',
    label: 'Homeschooling & family',
    short: 'Family',
    description: 'Children and young people, the adults who decide for them, and parents of young children.',
    status: 'live',
    offeringSlug: 'homeschooling',
    riskFloor: 'R2',
    color: '#a3e635',
  },
  {
    id: 'schools',
    label: 'Schools & educators',
    short: 'Schools',
    description: 'State schools, academy trusts, colleges and universities, and the firms that serve education.',
    status: 'planned',
    offeringSlug: null,
    riskFloor: 'R2',
    color: '#fbbf24',
  },
  {
    id: 'adults',
    label: 'Adults: life & career',
    short: 'Adults',
    description: 'Adults for themselves: work, career changes, money, health, caring, later life.',
    status: 'planned',
    offeringSlug: null,
    riskFloor: 'R1',
    color: '#f472b6',
  },
  {
    id: 'interests',
    label: 'Interests',
    short: 'Interests',
    description: 'Hobbies and passions: makers, fitness, languages, writing, games, faith.',
    status: 'planned',
    offeringSlug: null,
    riskFloor: null,
    color: '#a78bfa',
  },
  {
    id: 'public',
    label: 'Public sector',
    short: 'Public',
    description: 'Central and local government and the public services beyond education.',
    status: 'planned',
    offeringSlug: null,
    riskFloor: 'R2',
    color: '#34d399',
  },
];

export const PILLAR_BY_ID: Record<PillarId, Pillar> = Object.fromEntries(PILLARS.map((p) => [p.id, p])) as Record<PillarId, Pillar>;

export function isPillarId(value: string): value is PillarId {
  return value in PILLAR_BY_ID;
}

/** Education segments filed under Business or Public sector by type, but sold to schools. */
const SCHOOLS = new Set(['B2B-SEC-01', 'B2B-SEC-02', 'B2B-FUN-01', 'B2G-PUB-01', 'B2G-PUB-02', 'B2G-PUB-03', 'B2G-PUB-04']);
/** Parents of young children: an adult segment, but the family market is where they buy. */
const FAMILY_ADULTS = new Set(['B2C-ADU-03']);

/** The pillar an audience segment belongs to. Every catalogue code has exactly one; unknown codes have none. */
export function pillarOfSegment(code: string): PillarId | null {
  if (!(code in AUDIENCE_SEGMENTS)) return null;
  if (SCHOOLS.has(code)) return 'schools';
  if (FAMILY_ADULTS.has(code)) return 'homeschooling';
  switch (familyOf(code)) {
    case 'B2C-CYP':
    case 'B2C-GK':
      return 'homeschooling';
    case 'B2C-ADU':
      return 'adults';
    case 'B2C-INT':
      return 'interests';
    case 'B2B-SIZE':
    case 'B2B-SEC':
    case 'B2B-FUN':
      return 'business';
    default:
      return 'public'; // B2G-CEN, B2G-LOC, the rest of B2G-PUB
  }
}

/** Where a bot of a kind lands when nothing more specific says. */
export const DEFAULT_PILLAR: Record<AudienceKind, PillarId> = { B2B: 'business', B2G: 'public', B2C: 'adults' };

export type PillarInput = {
  audienceType: string | null;
  /** The bot's own segments (current version). */
  audienceSegments: readonly string[];
  isTutor: boolean;
  /** Its category's linked segments, in the category's order. Empty when it has no category. */
  categorySegments: readonly string[];
};

/**
 * A bot's pillar, first rule that applies:
 * 1. a curriculum tutor is Homeschooling & family;
 * 2. its first own segment of its own audience type decides;
 * 3. else its category's first segment of that type;
 * 4. else the default for its type (B2B Business, B2G Public sector, B2C Adults).
 *
 * Segments of another type never decide — since freelee #77 they do not
 * reach the prompt either, so they say nothing about who the bot talks to.
 */
export function pillarOfPersona(input: PillarInput): PillarId {
  if (input.isTutor) return 'homeschooling';
  const kind = input.audienceType === 'B2B' || input.audienceType === 'B2G' || input.audienceType === 'B2C' ? input.audienceType : null;
  const ofKind = (code: string) => kind !== null && AUDIENCE_SEGMENTS[code]?.audienceType === kind;
  const own = input.audienceSegments.find(ofKind);
  if (own) return pillarOfSegment(own) ?? DEFAULT_PILLAR[kind!];
  const fromCategory = input.categorySegments.find(ofKind);
  if (fromCategory) return pillarOfSegment(fromCategory) ?? DEFAULT_PILLAR[kind!];
  return DEFAULT_PILLAR[kind ?? 'B2B'];
}

/**
 * The pillars a category serves: those of its linked segments and of its
 * bots, in catalogue order. A field can serve several — Education serves
 * Business, Homeschooling & family and Schools.
 */
export function pillarsOfCategory(categorySegments: readonly string[], botPillars: readonly PillarId[]): PillarId[] {
  const found = new Set<PillarId>(botPillars);
  for (const code of categorySegments) {
    const pillar = pillarOfSegment(code);
    if (pillar) found.add(pillar);
  }
  return PILLARS.map((p) => p.id).filter((id) => found.has(id));
}

/** The segments of a pillar, in catalogue order. */
export function segmentsOfPillar(id: PillarId): string[] {
  return Object.keys(AUDIENCE_SEGMENTS).filter((code) => pillarOfSegment(code) === id);
}
