/**
 * The brief as prose, for a model.
 *
 * Split from `brief.ts` — which is `server-only` because it queries — so that
 * the rendering can be property-tested in `blocks:verify` without a database.
 * The assembly needs Postgres; turning the result into words does not, and the
 * words are the part with edge cases in them.
 */
import type { CategoryBrief } from './types';


/** Human-ish label for a snake_case vocabulary value: `key_needs` → `key needs`. */
function words(value: string): string {
  return value.replace(/_/g, ' ');
}

const RISK_MEANING: Record<string, string> = {
  R0: 'ordinary commercial subject matter — no special duty of care',
  R1: 'some potential for harm if the advice is wrong',
  R2: 'regulated or safety-relevant — wrong advice can do real damage',
  R3: 'high risk to life, liberty or livelihood',
};

/**
 * The brief as prose, for a model.
 *
 * This is the first time any of the taxonomy research reaches a language model.
 * It is written as a briefing to a person rather than a data dump, because that
 * is what models read well — and because everything in it is meant to inform
 * judgement, not to be copied out.
 *
 * Sectors are capped and audiences are summarised: the largest category has
 * eleven sectors, and a brief that grows with the taxonomy would quietly become
 * the most expensive part of every workbench turn.
 */
export function briefForModel(brief: CategoryBrief, options: { maxSectors?: number } = {}): string {
  const maxSectors = options.maxSectors ?? 8;
  const lines: string[] = [];

  lines.push(`# The field: ${brief.name}`);
  if (brief.description) lines.push(brief.description);

  const market: string[] = [];
  if (brief.market.size) market.push(`worth ${brief.market.size} in the UK`);
  if (brief.market.growth) market.push(`growing ${brief.market.growth}`);
  if (market.length) lines.push(`\n**Market.** This field is ${market.join(', ')}.`);

  if (brief.market.regulations.length) {
    lines.push(
      `**Regulation.** Work here touches ${brief.market.regulations.map(words).join(', ')}. ` +
        'Do not give advice that a regulated professional would have to give.',
    );
  }
  if (brief.market.industryBodies.length) {
    lines.push(`**Industry bodies.** ${brief.market.industryBodies.map(words).join(', ')}.`);
  }
  if (brief.riskLevel) {
    lines.push(`**Risk level ${brief.riskLevel}** — ${RISK_MEANING[brief.riskLevel] ?? 'unclassified'}.`);
  }

  if (brief.sectors.length) {
    const shown = brief.sectors.slice(0, maxSectors);
    lines.push('\n## Specialisms in this field');
    for (const sector of shown) {
      const modes = sector.interactionModes.length ? ` Works as: ${sector.interactionModes.join(', ').toLowerCase()}.` : '';
      lines.push(`- **${sector.name}**${sector.description ? ` — ${sector.description}` : ''}${modes}`);
    }
    if (brief.sectors.length > shown.length) {
      lines.push(`- …and ${brief.sectors.length - shown.length} more.`);
    }
  }

  if (brief.audiences.length) {
    lines.push('\n## Who this field serves');
    for (const audience of brief.audiences) {
      const bits: string[] = [];
      if (audience.ageRangeMin && audience.ageRangeMax) bits.push(`aged ${audience.ageRangeMin}–${audience.ageRangeMax}`);
      if (audience.ukContext) bits.push(audience.ukContext);
      const needs = audience.keyNeeds.slice(0, 5).map(words).join(', ');
      const tone = audience.preferredTone?.length ? ` Speak to them: ${audience.preferredTone.join(', ')}.` : '';
      lines.push(
        `- **${audience.name}** (${audience.audienceType}${bits.length ? `, ${bits.join(', ')}` : ''}) — ` +
          `needs ${needs}. Sensitivity to getting it wrong: ${words(audience.riskSensitivity)}.${tone}` +
          (audience.note ? ` ${audience.note}` : ''),
      );
    }
  } else {
    lines.push('\n## Who this field serves\nNobody has recorded an audience for this field yet.');
  }

  if (brief.guardrails.length) {
    lines.push(
      `\n## Safeguards expected here\n${brief.guardrails.map((g) => `- ${g.name}: ${g.description}`).join('\n')}`,
    );
  }

  return lines.join('\n');
}
