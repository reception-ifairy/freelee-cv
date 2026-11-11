/**
 * Read-only check that every stored persona can be saved from the admin form.
 *
 *   npm run personas:verify-form
 *
 * Builds, for each persona, exactly what the browser submits when an admin
 * opens the persona and presses Save without touching anything — empty inputs
 * as "", the version being edited (the draft if one exists, otherwise the
 * current one) — and runs it through the same schema savePersonaAction uses.
 *
 * Written because the legacy import (#58) left max_tokens NULL on every
 * persona, the form submitted that as "", and z.coerce turned "" into 0: all
 * 124 personas failed `min(64)` and nobody could save a single bot. A check
 * that walks the real rows catches the next import that writes a value the
 * form cannot round-trip, before an admin finds it by hand.
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { personaSchema, personaFieldError } from '../src/lib/persona/form-schema';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

const rows = await sql`
  select p.id, p.name, p.slug, p.tagline, p.description, p.expertise, p.accent_color, p.credits_per_message,
         p.position, p.sector_id,
         v.system_prompt, v.welcome_message, v.ai_provider, v.model, v.model_tier, v.temperature,
         v.frequency_penalty, v.presence_penalty, v.max_tokens, v.history_messages, v.audience_type,
         v.knowledge_domains, v.interaction_style, v.approach_to_unknown, v.prompt_technique,
         v.chat_layout, v.blueprint
    from personas p
    join persona_versions v on v.id = coalesce(p.draft_version_id, p.current_version_id)
   order by p.id`;

let failures = 0;
for (const row of rows) {
  // What each input renders as its value — see src/components/admin/persona-form.tsx.
  const form: Record<string, string> = {
    id: String(row.id),
    name: text(row.name),
    slug: text(row.slug),
    tagline: text(row.tagline),
    description: text(row.description),
    expertise: text(row.expertise),
    accentColor: text(row.accent_color),
    systemPrompt: text(row.system_prompt),
    welcomeMessage: text(row.welcome_message),
    aiProvider: text(row.ai_provider) || 'openai',
    model: text(row.model),
    modelTier: text(row.model_tier),
    temperature: text(row.temperature ?? 0.8),
    frequencyPenalty: text(row.frequency_penalty ?? 0),
    presencePenalty: text(row.presence_penalty ?? 0),
    maxTokens: text(row.max_tokens),
    historyMessages: text(row.history_messages ?? 8),
    audienceType: text(row.audience_type),
    knowledgeDomains: Array.isArray(row.knowledge_domains) ? row.knowledge_domains.join(', ') : '',
    creditsPerMessage: text(row.credits_per_message ?? 0),
    position: text(row.position ?? 0),
    interactionStyle: text(row.interaction_style),
    approachToUnknown: text(row.approach_to_unknown),
    promptTechnique: text(row.prompt_technique) || 'direct',
    chatLayout: text(row.chat_layout),
    sectorId: text(row.sector_id),
    blueprintJson: row.blueprint ? JSON.stringify(row.blueprint, null, 2) : '',
  };
  const parsed = personaSchema.safeParse(form);
  if (!parsed.success) {
    failures += 1;
    process.stdout.write(`FAIL: #${row.id} ${row.name} — ${personaFieldError(parsed.error.issues[0])?.error}\n`);
  }
}

await sql.end();
process.stdout.write(`${rows.length - failures}/${rows.length} personas save cleanly from the admin form\n`);
if (failures > 0) process.exit(1);
