import 'server-only';
import { z } from 'zod';
import { generateText } from 'ai';
import type { ModelMessage } from 'ai';
import { PERSONALITY_TRAITS } from '@/db/schema';
import { getProviderRegistry, getModel, resolveProviderId } from '@/lib/ai/registry';
import { getSettingString } from '@/lib/settings';
import type { ExtractedDocument } from '@/lib/documents/extract';

/**
 * Turns a document describing a bot — a character bio, a legacy config sheet,
 * a set of support guidelines — into a draft persona.
 *
 * The output targets **this app's existing persona shape**: the flat
 * name/tagline/prompt fields plus the camelCase `PersonaBlueprint` already in
 * `db/schema.ts`. The source design this was adapted from emitted its own
 * snake_case blueprint and a bag of loose key/value "attributes"; importing
 * that shape would have meant a second persona format to compile, migrate and
 * keep in step with the first. There is one persona format here.
 *
 * The result is always a **draft for review**, never a finished persona. An
 * extraction is a good first pass and a poor final answer, and the thing being
 * created is a public-facing character that will speak to customers.
 */

const trait = z.coerce.number().min(0).max(100).optional();

const blueprintSchema = z
  .object({
    identity: z
      .object({
        shortDescription: z.string().max(600).optional(),
        welcomeMessageTemplate: z.string().max(1000).optional(),
        expertProfile: z
          .object({
            domainOfExpertise: z.string().max(200).optional(),
            specialization: z.string().max(300).optional(),
            generalFunctionAsAi: z.string().max(600).optional(),
            coreOperatingProtocolSummary: z.string().max(1200).optional(),
            keyKnowledgeAreas: z.array(z.string().max(200)).max(20).optional(),
          })
          .optional(),
      })
      .optional(),
    personalityAndNarrativeProfile: z
      .object({
        personalityTraits: z.array(z.string().max(60)).max(20).optional(),
        coreInteractionStyle: z.string().max(600).optional(),
        emotionalRangeRepresentation: z.string().max(600).optional(),
        motivations: z.array(z.string().max(200)).max(10).optional(),
        interests: z.array(z.string().max(200)).max(10).optional(),
        favoriteQuotesOrSayings: z.array(z.string().max(300)).max(10).optional(),
        catchphrases: z.array(z.string().max(200)).max(10).optional(),
        humorProfile: z
          .object({
            levelAndStyle: z.string().max(400).optional(),
            examples: z.array(z.string().max(300)).max(10).optional(),
          })
          .optional(),
        relationshipToUser: z.string().max(600).optional(),
      })
      .optional(),
    communicationProfile: z
      .object({
        primaryLanguageSettings: z
          .object({
            defaultLanguageCode: z.string().max(10).optional(),
            languageLevelAdaptationDescription: z.string().max(600).optional(),
          })
          .optional(),
        speechCharacteristics: z
          .object({
            overallSpeechStyle: z.string().max(600).optional(),
            voiceAttributes: z.string().max(400).optional(),
          })
          .optional(),
        writingStyle: z
          .object({
            overallStyle: z.string().max(600).optional(),
            examples: z.array(z.string().max(400)).max(10).optional(),
          })
          .optional(),
        clarityTechniques: z
          .object({
            useOfAnalogiesOrComparisons: z.string().max(600).optional(),
            encouragementAndPositiveFraming: z.string().max(600).optional(),
          })
          .optional(),
      })
      .optional(),
    interactionAndPedagogyProfile: z
      .object({
        coreTeachingOrGuidanceMethodology: z.string().max(800).optional(),
        interactionStyleSummary: z.string().max(600).optional(),
        learningOrGoalObjectives: z
          .object({
            primaryGoals: z.array(z.string().max(300)).max(10).optional(),
            secondaryGoals: z.array(z.string().max(300)).max(10).optional(),
          })
          .optional(),
        lessonOrInteractionStructure: z
          .object({ defaultLengthOrFormat: z.string().max(400).optional() })
          .optional(),
        feedbackAndSupportSystems: z
          .object({
            feedbackMechanisms: z.array(z.string().max(300)).max(10).optional(),
            emotionalIntelligenceCapabilities: z.string().max(600).optional(),
          })
          .optional(),
      })
      .optional(),
    contentIntegrityAndSafety: z
      .object({
        factualAccuracyApproach: z.string().max(800).optional(),
        ethicalInteractionPrinciples: z.string().max(800).optional(),
        handlingSensitiveOrTabooTopics: z.string().max(800).optional(),
      })
      .optional(),
    finalStatements: z.object({ disclaimerOrSafetyNotes: z.string().max(800).optional() }).optional(),
  })
  // Anything the model invents outside the known shape is dropped rather than
  // stored: `blueprint` is compiled straight into a system prompt, and an
  // unrecognised key would be silently ignored by the compiler anyway.
  .strip();

/**
 * The full draft. Every field is optional but `name` and `systemPrompt` — a
 * conversion that produced neither has not produced a persona.
 */
export const convertedPersonaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(255).optional(),
  description: z.string().trim().max(4000).optional(),
  expertise: z.string().trim().max(120).optional(),
  systemPrompt: z.string().trim().min(20).max(20000),
  welcomeMessage: z.string().trim().max(2000).optional(),
  suggestions: z.array(z.string().trim().max(120)).max(4).default([]),
  knowledgeDomains: z.array(z.string().trim().max(80)).max(12).default([]),
  audienceType: z.enum(['B2B', 'B2C', 'B2G']).optional(),
  interactionStyle: z.enum(['formal', 'casual', 'enthusiastic', 'concise', 'socratic']).optional(),
  approachToUnknown: z.enum(['admit_ignorance', 'educated_guess', 'ask_clarifying']).optional(),
  promptTechnique: z.enum(['direct', 'chain_of_thought']).default('direct'),
  personality: z.object(Object.fromEntries(PERSONALITY_TRAITS.map((t) => [t, trait]))).default({}),
  blueprint: blueprintSchema.default({}),
});

export type ConvertedPersona = z.infer<typeof convertedPersonaSchema>;

const SYSTEM_PROMPT = [
  'You are a persona architect. You are given a document that describes a chatbot, an AI character,',
  'a support agent, or a role a business wants an assistant to play. Your job is to read it and',
  'produce a complete, ready-to-edit persona definition for a conversational AI platform.',
  '',
  'Rules:',
  '- Ground everything in the document. Where it is silent, infer what a competent designer would',
  '  choose for this character — do not invent facts about the business, its products, its prices,',
  '  its policies or its people.',
  '- `systemPrompt` is the important field. Write it in the second person ("You are …"), covering the',
  '  role, what it knows, how it speaks, what it must not do, and how it handles questions outside',
  '  its remit. 150–400 words. It must read as instructions to a model, not as a description of one.',
  '- `personality` scores every trait from 0 to 100, where 50 is neutral. Make them reflect the',
  '  document: a formal compliance adviser is low warmth and humour and high rigor; a playful brand',
  '  mascot is the reverse. Do not return all fifties.',
  '- `suggestions` are up to four opening questions a real user would click, written in their voice,',
  '  under twelve words each.',
  '- `knowledgeDomains` are short subject labels, not sentences.',
  '- Use the language of the document itself for all user-facing text (name, tagline, description,',
  '  welcome message, suggestions). Keep the enum fields in English.',
  '- If the document is not about a bot or a character at all, still produce your best persona for the',
  '  subject matter it does cover, and say so in `description`.',
  '',
  'Return ONLY a JSON object with this exact shape. No markdown fences, no commentary.',
  '',
  JSON.stringify(
    {
      name: 'string',
      tagline: 'string, under 80 characters',
      description: 'string, 2-4 sentences for the marketplace card',
      expertise: 'string, a short field label e.g. "Tax law"',
      systemPrompt: 'string',
      welcomeMessage: 'string, the first thing it says',
      suggestions: ['string'],
      knowledgeDomains: ['string'],
      audienceType: 'B2B | B2C | B2G',
      interactionStyle: 'formal | casual | enthusiastic | concise | socratic',
      approachToUnknown: 'admit_ignorance | educated_guess | ask_clarifying',
      promptTechnique: 'direct | chain_of_thought',
      personality: Object.fromEntries(PERSONALITY_TRAITS.map((t) => [t, '0-100'])),
      blueprint: {
        identity: {
          shortDescription: 'string',
          welcomeMessageTemplate: 'string',
          expertProfile: {
            domainOfExpertise: 'string',
            specialization: 'string',
            generalFunctionAsAi: 'string',
            coreOperatingProtocolSummary: 'string',
            keyKnowledgeAreas: ['string'],
          },
        },
        personalityAndNarrativeProfile: {
          personalityTraits: ['string'],
          coreInteractionStyle: 'string',
          emotionalRangeRepresentation: 'string',
          motivations: ['string'],
          interests: ['string'],
          catchphrases: ['string'],
          humorProfile: { levelAndStyle: 'string', examples: ['string'] },
          relationshipToUser: 'string',
        },
        communicationProfile: {
          primaryLanguageSettings: { defaultLanguageCode: 'string', languageLevelAdaptationDescription: 'string' },
          speechCharacteristics: { overallSpeechStyle: 'string', voiceAttributes: 'string' },
          writingStyle: { overallStyle: 'string', examples: ['string'] },
          clarityTechniques: { useOfAnalogiesOrComparisons: 'string', encouragementAndPositiveFraming: 'string' },
        },
        interactionAndPedagogyProfile: {
          coreTeachingOrGuidanceMethodology: 'string',
          interactionStyleSummary: 'string',
          learningOrGoalObjectives: { primaryGoals: ['string'], secondaryGoals: ['string'] },
          lessonOrInteractionStructure: { defaultLengthOrFormat: 'string' },
          feedbackAndSupportSystems: { feedbackMechanisms: ['string'], emotionalIntelligenceCapabilities: 'string' },
        },
        contentIntegrityAndSafety: {
          factualAccuracyApproach: 'string',
          ethicalInteractionPrinciples: 'string',
          handlingSensitiveOrTabooTopics: 'string',
        },
        finalStatements: { disclaimerOrSafetyNotes: 'string' },
      },
    },
    null,
    1,
  ),
].join('\n');

/** Models wrap JSON in a fence often enough that stripping it is cheaper than re-prompting. */
function stripCodeFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}

/**
 * Finds the outermost JSON object in a reply.
 *
 * Belt and braces over the fence strip: some models prepend a sentence no
 * amount of prompting removes, and re-running the conversion costs a real API
 * call — worth one substring to avoid.
 */
function isolateJson(text: string): string {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  return start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
}

export type ConversionResult =
  | { ok: true; persona: ConvertedPersona; provider: string; model: string }
  | { ok: false; error: string };

/**
 * Runs the extraction against the platform's configured default chat model —
 * the same one the translator uses. It is deliberately not the persona's own
 * model: there is no persona yet.
 */
export async function convertDocumentToPersona(
  source: ExtractedDocument,
  { filename, hint }: { filename: string; hint?: string },
): Promise<ConversionResult> {
  const registry = await getProviderRegistry();
  const providerId = resolveProviderId(await getSettingString('ai_default_provider', 'openai'));
  const modelId = registry[providerId]?.defaultModel;
  if (!modelId) return { ok: false, error: `No default model is configured for ${providerId}.` };

  const apiKey = (await getSettingString(`${providerId}_api_key`)) || undefined;
  const model = getModel(registry, providerId, modelId, { apiKey });

  const preamble =
    `Source document: ${filename}` +
    (hint ? `\nThe admin adds this context: ${hint}` : '') +
    (source.mode === 'text' && source.truncated
      ? '\n(The document was long and has been truncated — work from what is here.)'
      : '');

  const messages: ModelMessage[] =
    source.mode === 'file'
      ? [
          {
            role: 'user',
            content: [
              { type: 'text', text: preamble },
              { type: 'file', data: source.base64, mediaType: source.mediaType },
            ],
          },
        ]
      : [{ role: 'user', content: `${preamble}\n\n---\n\n${source.text}` }];

  let raw: string;
  try {
    const result = await generateText({ model, system: SYSTEM_PROMPT, messages });
    raw = result.text;
  } catch (error) {
    // Surfaced rather than swallowed: "no credit" and "this model cannot read
    // PDFs" are both things the admin can act on, and a generic failure message
    // would send them looking in the wrong place.
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${registry[providerId].label} refused the request: ${message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(isolateJson(raw));
  } catch {
    return { ok: false, error: 'The model did not return valid JSON. Try again, or use a stronger default model.' };
  }

  const validated = convertedPersonaSchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return { ok: false, error: `The extracted persona was incomplete: ${issue?.path.join('.')} — ${issue?.message}.` };
  }

  return { ok: true, persona: validated.data, provider: registry[providerId].label, model: modelId };
}
