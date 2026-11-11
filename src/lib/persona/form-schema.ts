import { z } from 'zod';
import { isChatProvider } from '@/lib/ai/provider-ids';

/*
 * The admin persona form's validation, in a plain module so it can be checked
 * outside a request: a 'use server' file may only export async functions, and
 * scripts/verify-persona-form.ts runs every stored persona through this exact
 * schema the way the browser would submit it.
 */

/**
 * What an empty optional field submits is `""`, not "missing". Without this,
 * `z.coerce.number()` turns `""` into 0 (failing `min(64)` on Max tokens) and
 * a "Not set" option fails its enum — which is exactly how every persona the
 * legacy import wrote (all with NULL max_tokens) became unsaveable. Blank
 * means "use the default", so it is mapped to undefined before validation.
 */
const blank = (value: unknown) => (value === '' || value == null ? undefined : value);

export const personaSchema = z.object({
  sectorId: z.string().trim().optional(),
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(255).optional(),
  description: z.string().trim().max(4000).optional(),
  expertise: z.string().trim().max(120).optional(),
  accentColor: z.string().trim().max(16).default('#6366f1'),
  systemPrompt: z.string().trim().min(20, 'The system prompt needs to be meaningful.'),
  welcomeMessage: z.string().trim().max(2000).optional(),
  // Image-generation providers (e.g. 'stability') are catalog/admin-config only
  // this phase — a persona can never actually be assigned one, see docs/21-image-engines.md.
  aiProvider: z.string().trim().min(1).refine(isChatProvider, 'Not a valid chat provider.'),
  model: z.string().trim().max(120).optional(),
  // '' means "follow the suggestion computed from category/audience" — stored as
  // NULL so the suggestion stays live as the taxonomy changes, rather than being
  // frozen at whatever it happened to be on the day the persona was saved.
  chatLayout: z.string().trim().optional(),
  modelTier: z.preprocess(blank, z.enum(['fast', 'balanced', 'advanced']).optional()),
  temperature: z.coerce.number().min(0).max(2),
  frequencyPenalty: z.coerce.number().min(-2).max(2).default(0),
  presencePenalty: z.coerce.number().min(-2).max(2).default(0),
  maxTokens: z.preprocess(blank, z.coerce.number().int().min(64).max(32000).optional()),
  historyMessages: z.coerce.number().int().min(1).max(30).default(8),
  audienceType: z.preprocess(blank, z.enum(['B2B', 'B2C', 'B2G']).optional()),
  knowledgeDomains: z.string().trim().optional(),
  creditsPerMessage: z.coerce.number().int().min(0).default(0),
  position: z.coerce.number().int().default(0),
  interactionStyle: z.preprocess(blank, z.enum(['formal', 'casual', 'enthusiastic', 'concise', 'socratic']).optional()),
  approachToUnknown: z.preprocess(blank, z.enum(['admit_ignorance', 'educated_guess', 'ask_clarifying']).optional()),
  promptTechnique: z.enum(['direct', 'chain_of_thought']).default('direct'),
  blueprintJson: z.string().trim().optional(),
});

/**
 * Where each persona field lives on the form and what a person should do when
 * it is wrong. A raw zod message ("Too small: expected number to be >=64") with
 * no field name, shown above six tabs, is how a one-field problem looked like
 * "saving is broken". The form uses `tab` to switch to the field.
 */
type PersonaTab = 'basics' | 'prompt' | 'model' | 'personality' | 'capabilities' | 'publishing';
const PERSONA_FIELDS: Record<string, { label: string; tab: PersonaTab; fix?: string }> = {
  name: { label: 'Name', tab: 'basics', fix: 'use 2–120 characters' },
  slug: { label: 'Slug', tab: 'basics', fix: 'use at most 120 characters' },
  tagline: { label: 'Tagline', tab: 'basics', fix: 'use at most 255 characters' },
  description: { label: 'Description', tab: 'basics', fix: 'use at most 4,000 characters' },
  expertise: { label: 'Expertise', tab: 'basics', fix: 'use at most 120 characters' },
  accentColor: { label: 'Accent colour', tab: 'basics' },
  systemPrompt: { label: 'System prompt', tab: 'prompt', fix: 'write at least 20 characters' },
  welcomeMessage: { label: 'Welcome message', tab: 'prompt', fix: 'use at most 2,000 characters' },
  blueprintJson: { label: 'Cognitive blueprint', tab: 'prompt' },
  aiProvider: { label: 'AI provider', tab: 'model', fix: 'pick a chat provider' },
  model: { label: 'Model', tab: 'model' },
  modelTier: { label: 'Model tier', tab: 'model' },
  temperature: { label: 'Temperature', tab: 'model', fix: 'use a value from 0 to 2' },
  frequencyPenalty: { label: 'Frequency penalty', tab: 'model', fix: 'use a value from -2 to 2' },
  presencePenalty: { label: 'Presence penalty', tab: 'model', fix: 'use a value from -2 to 2' },
  maxTokens: { label: 'Max tokens', tab: 'model', fix: 'enter 64–32,000, or leave it empty for the model default' },
  historyMessages: { label: 'History messages', tab: 'model', fix: 'use 1–30' },
  interactionStyle: { label: 'Interaction style', tab: 'model' },
  approachToUnknown: { label: 'Approach to unknown', tab: 'model' },
  promptTechnique: { label: 'Prompt technique', tab: 'model' },
  chatLayout: { label: 'Chat layout', tab: 'capabilities' },
  audienceType: { label: 'Audience type', tab: 'personality' },
  knowledgeDomains: { label: 'Knowledge domains', tab: 'personality' },
  creditsPerMessage: { label: 'Credits per message', tab: 'publishing', fix: 'use a whole number, 0 or more' },
  position: { label: 'Position', tab: 'publishing', fix: 'use a whole number' },
  sectorId: { label: 'Specialism', tab: 'publishing' },
};

export type PersonaSaveState = { error?: string; success?: string; field?: string; tab?: PersonaTab } | null;

export function personaFieldError(issue: z.core.$ZodIssue | undefined): PersonaSaveState {
  const field = String(issue?.path?.[0] ?? '');
  const meta = PERSONA_FIELDS[field];
  if (!meta) return { error: issue?.message ?? 'Please check the form.' };
  const tabLabel = meta.tab.charAt(0).toUpperCase() + meta.tab.slice(1);
  return { error: `${meta.label} (${tabLabel} tab): ${meta.fix ?? issue?.message ?? 'check this field'}.`, field, tab: meta.tab };
}

