import type { Persona, PersonaVersion, PersonaBlueprint, PromptModifier } from '@/db/schema';
import { PERSONALITY_TRAITS, type PersonalityTrait } from '@/db/schema';
import type { KnowledgeChunk } from '@/lib/knowledge/types';
import { GUARDRAILS, isGuardrailCode } from '@/lib/persona/guardrails';

/**
 * The grounding budget.
 *
 * Sized originally for one-paragraph results from a remote search API. A
 * passage from a book is not that: 500 characters of one is two sentences,
 * which strands the model with a quotation that stops mid-argument and a
 * citation it cannot honestly use.
 *
 * ~3,600 characters is roughly 900 input tokens on every grounded turn, and
 * `costForTokens` bills input and output alike — so this constant is a price
 * as much as a size. It sits just above what `searchLibrary` will hand over
 * (its own `maxChars`, 3,300), which stays the real limit: this one only has
 * to stop a remote source from overflowing the section.
 */
const GROUNDING_MAX_CHARS = 3600;
const GROUNDING_CHUNK_CHARS = 1600;

export const AUDIENCE_TYPES = {
  B2B: { label: 'Business (B2B)', description: 'Businesses, teams and professionals' },
  B2C: { label: 'Consumer (B2C)', description: 'Individual users and consumers' },
  B2G: { label: 'Public Sector (B2G)', description: 'Government, civic and public organisations' },
} as const;

export type AudienceTypeId = keyof typeof AUDIENCE_TYPES;

/** @deprecated use AUDIENCE_TYPES */
export const CURRICULUM_LEVELS = AUDIENCE_TYPES as unknown as Record<string, { label: string }>;

/**
 * Cognitive knobs ported from the Personat.AI blueprint engine. These sit
 * beside temperature/topP: they steer *how* a persona phrases itself rather
 * than the sampling of the model.
 */
export const INTERACTION_STYLES = {
  formal: { label: 'Formal', instruction: 'Write in a highly professional, academic and structured tone. Avoid casual phrasing, contractions or emojis. Use impeccable grammar and authoritative structures.' },
  casual: { label: 'Casual', instruction: 'Write in a warm, friendly, conversational and laid-back tone. You may use common contractions, relaxed greetings and a few context-appropriate emojis.' },
  enthusiastic: { label: 'Enthusiastic', instruction: 'Write with high energy, positivity and excitement. Be encouraging, use exclamation marks appropriately, and show passionate interest in the user\u2019s topics.' },
  concise: { label: 'Concise', instruction: 'Write in an extremely brief, to-the-point style. Avoid conversational fluff or long introductions. Deliver maximum useful information in minimum words.' },
  socratic: { label: 'Socratic', instruction: 'Adopt the Socratic method. Rarely give a direct answer immediately \u2014 instead guide the user with targeted, thought-provoking questions, helping them arrive at the answer step by step.' },
} as const;

export const APPROACH_TO_UNKNOWN = {
  admit_ignorance: { label: 'Admit ignorance', instruction: 'If you do not know the answer or lack sufficient data, admit it immediately and decline to speculate. Never invent facts.' },
  educated_guess: { label: 'Make an educated guess', instruction: 'If you are unsure of a fact, make an educated guess but append a clear disclaimer explaining your reasoning, confidence level and assumptions.' },
  ask_clarifying: { label: 'Ask clarifying questions', instruction: 'If the request is ambiguous or you lack context, pause and ask targeted clarifying questions before answering instead of guessing.' },
} as const;

export const PROMPT_TECHNIQUES = {
  direct: { label: 'Direct', instruction: null },
  chain_of_thought: { label: 'Chain of thought', instruction: 'Explicitly reason step by step. Explain your assumptions and logic before stating your final conclusion.' },
} as const;

export type InteractionStyleId = keyof typeof INTERACTION_STYLES;
export type ApproachToUnknownId = keyof typeof APPROACH_TO_UNKNOWN;
export type PromptTechniqueId = keyof typeof PROMPT_TECHNIQUES;

const SUGGESTIONS_TAG_RE = /\[SUGGESTIONS:\s*([^\]]+)\]\s*$/i;

/** Strips a trailing `[SUGGESTIONS: A | B | C]` tag and returns both parts. */
export function parseSuggestions(text: string): { text: string; suggestions: string[] } {
  const match = text.match(SUGGESTIONS_TAG_RE);
  if (!match) return { text, suggestions: [] };

  const suggestions = match[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return { text: text.slice(0, match.index).trimEnd(), suggestions };
}

function describeLevel(value: number): string {
  if (value >= 85) return 'very high';
  if (value >= 65) return 'high';
  if (value >= 40) return 'moderate';
  if (value >= 20) return 'low';
  return 'minimal';
}

/**
 * Compiles a deep PersonaBlueprint into a cohesive identity brief. Ported
 * from the Personat.AI cognitive-architecture engine — every field is
 * optional so a partially-filled blueprint still produces useful output.
 */
function compileBlueprintSection(blueprint: PersonaBlueprint): string {
  const identity = blueprint.identity ?? {};
  const expert = identity.expertProfile ?? {};
  const narrative = blueprint.personalityAndNarrativeProfile ?? {};
  const humor = narrative.humorProfile ?? {};
  const communication = blueprint.communicationProfile ?? {};
  const language = communication.primaryLanguageSettings ?? {};
  const speech = communication.speechCharacteristics ?? {};
  const writing = communication.writingStyle ?? {};
  const clarity = communication.clarityTechniques ?? {};
  const pedagogy = blueprint.interactionAndPedagogyProfile ?? {};
  const goals = pedagogy.learningOrGoalObjectives ?? {};
  const structure = pedagogy.lessonOrInteractionStructure ?? {};
  const feedback = pedagogy.feedbackAndSupportSystems ?? {};
  const safety = blueprint.contentIntegrityAndSafety ?? {};
  const final = blueprint.finalStatements ?? {};

  const lines: string[] = [];

  if (identity.shortDescription) lines.push(identity.shortDescription);
  if (expert.specialization || expert.domainOfExpertise) {
    lines.push(`Expert specialization: ${expert.specialization ?? 'General support'} (${expert.domainOfExpertise ?? 'general domain'}).`);
  }
  if (expert.coreOperatingProtocolSummary) lines.push(`Core operating protocol: ${expert.coreOperatingProtocolSummary}`);
  if (expert.keyKnowledgeAreas?.length) lines.push(`Key knowledge areas: ${expert.keyKnowledgeAreas.join(', ')}.`);

  const personalityLines: string[] = [];
  if (narrative.personalityTraits?.length) personalityLines.push(`- Traits: ${narrative.personalityTraits.join(', ')}`);
  if (narrative.coreInteractionStyle) personalityLines.push(`- Core interaction style: ${narrative.coreInteractionStyle}`);
  if (narrative.emotionalRangeRepresentation) personalityLines.push(`- Emotional demeanour: ${narrative.emotionalRangeRepresentation}`);
  if (narrative.motivations?.length) personalityLines.push(`- Motivations: ${narrative.motivations.join(', ')}`);
  if (narrative.interests?.length) personalityLines.push(`- Interests: ${narrative.interests.join(', ')}`);
  if (narrative.favoriteQuotesOrSayings?.length) personalityLines.push(`- Favourite sayings: ${narrative.favoriteQuotesOrSayings.join('; ')}`);
  if (narrative.catchphrases?.length) personalityLines.push(`- Catchphrases: ${narrative.catchphrases.join(' | ')}`);
  if (narrative.relationshipToUser) personalityLines.push(`- Relationship to user: ${narrative.relationshipToUser}`);
  if (humor.levelAndStyle) personalityLines.push(`- Humour: ${humor.levelAndStyle}${humor.examples?.length ? ` (e.g. ${humor.examples.join('; ')})` : ''}`);
  if (personalityLines.length) lines.push(`\nPERSONALITY & NARRATIVE PROFILE:\n${personalityLines.join('\n')}`);

  const commLines: string[] = [];
  if (language.defaultLanguageCode || language.languageLevelAdaptationDescription) {
    commLines.push(`- Language: ${language.defaultLanguageCode ?? 'en-US'}. ${language.languageLevelAdaptationDescription ?? ''}`.trim());
  }
  if (speech.overallSpeechStyle || speech.voiceAttributes) {
    commLines.push(`- Speech: ${speech.overallSpeechStyle ?? 'Clear'} (${speech.voiceAttributes ?? 'neutral'})`);
  }
  if (writing.overallStyle) commLines.push(`- Writing style: ${writing.overallStyle}${writing.examples?.length ? ` — e.g. "${writing.examples.join(' | ')}"` : ''}`);
  if (clarity.useOfAnalogiesOrComparisons || clarity.encouragementAndPositiveFraming) {
    commLines.push(`- Clarity: ${clarity.useOfAnalogiesOrComparisons ?? ''} ${clarity.encouragementAndPositiveFraming ?? ''}`.trim());
  }
  if (commLines.length) lines.push(`\nCOMMUNICATION PROFILE:\n${commLines.join('\n')}`);

  const pedagogyLines: string[] = [];
  if (pedagogy.coreTeachingOrGuidanceMethodology) pedagogyLines.push(`- Methodology: ${pedagogy.coreTeachingOrGuidanceMethodology}`);
  if (pedagogy.interactionStyleSummary) pedagogyLines.push(`- Interaction summary: ${pedagogy.interactionStyleSummary}`);
  if (goals.primaryGoals?.length || goals.secondaryGoals?.length) {
    pedagogyLines.push(`- Objectives: primary — ${goals.primaryGoals?.join(', ') ?? 'n/a'}; secondary — ${goals.secondaryGoals?.join(', ') ?? 'n/a'}`);
  }
  if (structure.defaultLengthOrFormat) pedagogyLines.push(`- Preferred structure: ${structure.defaultLengthOrFormat}`);
  if (feedback.feedbackMechanisms?.length) pedagogyLines.push(`- Feedback style: ${feedback.feedbackMechanisms.join(', ')}`);
  if (feedback.emotionalIntelligenceCapabilities) pedagogyLines.push(`- Emotional intelligence: ${feedback.emotionalIntelligenceCapabilities}`);
  if (pedagogyLines.length) lines.push(`\nINTERACTION METHODOLOGY:\n${pedagogyLines.join('\n')}`);

  const safetyLines: string[] = [];
  if (safety.factualAccuracyApproach) safetyLines.push(`- Factual accuracy: ${safety.factualAccuracyApproach}`);
  if (safety.ethicalInteractionPrinciples) safetyLines.push(`- Ethical stance: ${safety.ethicalInteractionPrinciples}`);
  if (safety.handlingSensitiveOrTabooTopics) safetyLines.push(`- Sensitive topics: ${safety.handlingSensitiveOrTabooTopics}`);
  if (safetyLines.length) lines.push(`\nCONTENT INTEGRITY & SAFETY:\n${safetyLines.join('\n')}`);

  if (final.disclaimerOrSafetyNotes) lines.push(`\nDisclaimer: ${final.disclaimerOrSafetyNotes}`);

  return lines.join('\n');
}

/**
 * Assembles the final system prompt: base instruction + blueprint (if any) +
 * identity + personality + audience + cognitive overrides + modifiers.
 *
 * Traits are rendered as named, quantified instructions ("Patience: very high
 * (95/100)") rather than left implicit, because models follow explicit
 * instructions far more reliably than they infer tone from adjectives.
 */
export function buildSystemPrompt(
  // 'name'/'expertise' are identity (stay on Persona); everything else is
  // versioned content (moved to PersonaVersion, Phase 4 — see
  // docs/11-persona-versioning.md). Callers pass a merged object.
  persona: Pick<Persona, 'name' | 'expertise'> &
    Pick<
      PersonaVersion,
      | 'systemPrompt' | 'personality' | 'knowledgeDomains' | 'audienceType'
      | 'blueprint' | 'interactionStyle' | 'approachToUnknown' | 'promptTechnique' | 'guardrails'
    >,
  modifiers: Pick<PromptModifier, 'type' | 'value'>[] = [],
  levelOverride?: AudienceTypeId | null,
  groundingChunks: KnowledgeChunk[] = [],
): string {
  const sections: string[] = [persona.systemPrompt.trim()];

  if (persona.blueprint) {
    const compiled = compileBlueprintSection(persona.blueprint);
    if (compiled.trim()) sections.push(`## Cognitive blueprint\n${compiled}`);
  }

  const identity: string[] = [`You are ${persona.name}.`];
  if (persona.expertise) identity.push(`Your field of expertise is ${persona.expertise}.`);
  if (persona.knowledgeDomains.length > 0) {
    identity.push(`Your knowledge domains: ${persona.knowledgeDomains.join(', ')}.`);
  }
  sections.push(`## Identity\n${identity.join(' ')}`);

  const traits = PERSONALITY_TRAITS.filter(
    (trait: PersonalityTrait) => typeof persona.personality[trait] === 'number',
  );

  if (traits.length > 0) {
    const lines = traits.map((trait) => {
      const value = persona.personality[trait] as number;
      const name = trait.charAt(0).toUpperCase() + trait.slice(1);
      return `- ${name}: ${describeLevel(value)} (${value}/100)`;
    });
    sections.push(`## Personality\nExpress these traits consistently in every reply:\n${lines.join('\n')}`);
  }

  const audience = levelOverride ?? persona.audienceType;
  if (audience && audience in AUDIENCE_TYPES) {
    const meta = AUDIENCE_TYPES[audience as AudienceTypeId];
    sections.push(
      `## Audience\nThis persona is optimised for the **${meta.label}** audience. ` +
        `${meta.description}. ` +
        'Match your tone, examples and depth to this audience in every reply.',
    );
  }

  if (persona.guardrails.length > 0) {
    const active = persona.guardrails.filter(isGuardrailCode).map((code) => GUARDRAILS[code]);
    if (active.length > 0) {
      const lines = active.map(
        (g) => `- **${g.name}** (${g.severity}): ${g.description}. If triggered, respond along these lines: "${g.responseTemplate}"`,
      );
      sections.push(`## Guardrails\nApply these safety and compliance guardrails at all times:\n${lines.join('\n')}`);
    }
  }

  if (groundingChunks.length > 0) {
    /*
     * Whole references only, dropped from the end.
     *
     * The old truncation sliced the joined string at a fixed offset, which
     * could cut through the middle of a `[citation]` — handing the model a
     * malformed reference that it would then reproduce, and a quotation that
     * stops mid-word as if the source did.
     */
    const kept: string[] = [];
    let budget = GROUNDING_MAX_CHARS;
    for (const chunk of groundingChunks) {
      const text = chunk.text.length > GROUNDING_CHUNK_CHARS
        ? `${chunk.text.slice(0, GROUNDING_CHUNK_CHARS).replace(/\s+\S*$/, '')}…`
        : chunk.text;
      const line = `- ${chunk.title}: ${text} [${chunk.citation}]`;
      if (line.length > budget) break;
      budget -= line.length + 1;
      kept.push(line);
    }
    if (kept.length > 0) {
      sections.push(`## Grounding — cite these references when you use them\n${kept.join('\n')}`);
    }
  }

  if (modifiers.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const modifier of modifiers) {
      const list = grouped.get(modifier.type) ?? [];
      list.push(modifier.value);
      grouped.set(modifier.type, list);
    }

    const lines = [...grouped.entries()].map(
      ([type, values]) => `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${values.join(' ')}`,
    );
    sections.push(`## Response requirements\n${lines.join('\n')}`);
  }

  const cognitiveLines: string[] = [];
  if (persona.interactionStyle) cognitiveLines.push(`- ${INTERACTION_STYLES[persona.interactionStyle as InteractionStyleId].instruction}`);
  if (persona.approachToUnknown) cognitiveLines.push(`- ${APPROACH_TO_UNKNOWN[persona.approachToUnknown as ApproachToUnknownId].instruction}`);
  const technique = PROMPT_TECHNIQUES[(persona.promptTechnique as PromptTechniqueId) ?? 'direct'];
  if (technique?.instruction) cognitiveLines.push(`- ${technique.instruction}`);
  if (cognitiveLines.length > 0) {
    sections.push(`## Cognitive & interaction overrides\n${cognitiveLines.join('\n')}`);
  }

  sections.push(
    '## Output formatting mandate\n' +
      'At the very end of your response, append exactly 2 or 3 short, clickable follow-up options the ' +
      'user might say next, on a single trailing line formatted exactly as: ' +
      '[SUGGESTIONS: Option A | Option B | Option C]. Do not wrap it in code blocks or extra punctuation.',
  );

  return sections.join('\n\n');
}

