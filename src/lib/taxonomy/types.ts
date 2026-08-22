/**
 * The shape of a category brief.
 *
 * Its own module so both halves can use it: `brief.ts` assembles one and is
 * `server-only`; `render.ts` turns one into prose and is deliberately not, so
 * the rendering can be tested without a database.
 */
import type { AudienceSegmentConfig } from '@/lib/persona/audience-segments';
import type { GuardrailConfig } from '@/lib/persona/guardrails';
import type { ChatLayoutKey } from '@/lib/chat/layouts';

export type BriefSector = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  b2c: number;
  b2b: number;
  b2g: number;
  riskLevel: string | null;
  narrativeFit: string | null;
  interactionModes: string[];
  personaCount: number;
};

export type BriefAudience = AudienceSegmentConfig & { note: string | null };

export type CategoryBrief = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  /** UK market context — written by the admin form since Phase 5 and read by nothing until now. */
  market: {
    size: string | null;
    growth: string | null;
    regulations: string[];
    industryBodies: string[];
  };
  riskLevel: 'R0' | 'R1' | 'R2' | 'R3' | null;
  narrativePotential: string | null;
  sectors: BriefSector[];
  audiences: BriefAudience[];
  /** Which audience types this field leans towards, averaged over its sectors. */
  audienceLean: { b2c: number; b2b: number; b2g: number };
  /** The chat layout this category's slug maps to — a behaviour contract, shown where it is decided. */
  layout: { key: ChatLayoutKey; label: string };
  /** Tools `suggestedToolsFor` would pre-tick for a persona filed here. */
  suggestedTools: { key: string; label: string }[];
  /** Guardrails whose own `appliesToRiskLevels` covers this field's risk level. */
  guardrails: GuardrailConfig[];
};

