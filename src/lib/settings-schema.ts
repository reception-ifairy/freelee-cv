export type FieldType = 'string' | 'text' | 'bool' | 'int' | 'secret';
export type Field = { key: string; label: string; type: FieldType; help?: string };

/**
 * The schema drives the whole settings UI, so adding an option is a one-line
 * change — no new page, no new migration, no new action.
 *
 * Lives in its own plain module (no 'use client', no 'server-only') because
 * it's consumed from both a Server Component (src/app/admin/settings/page.tsx)
 * and a Client Component (src/components/admin/settings-form.tsx). Defining
 * it inside the 'use client' file broke server-side access: Next's RSC
 * bundler strips the real value at the server boundary and left
 * `SETTINGS_SCHEMA[group]` undefined there, crashing the settings page with
 * "SETTINGS_SCHEMA[k] is not iterable".
 */
export const SETTINGS_SCHEMA = {
  general: [
    { key: 'site_name', label: 'Site name', type: 'string' },
    { key: 'site_description', label: 'Site description', type: 'text' },
    { key: 'support_email', label: 'Support email', type: 'string' },
    { key: 'allow_registration', label: 'Allow new registrations', type: 'bool' },
  ],
  ai: [
    { key: 'ai_default_provider', label: 'Default provider', type: 'string', help: 'openai, anthropic, openrouter, ollama' },
    { key: 'openai_api_key', label: 'OpenAI API key', type: 'secret' },
    { key: 'openai_default_model', label: 'OpenAI default model', type: 'string' },
    { key: 'anthropic_api_key', label: 'Anthropic API key', type: 'secret' },
    { key: 'anthropic_default_model', label: 'Anthropic default model', type: 'string' },
    { key: 'google_api_key', label: 'Google (Gemini) API key', type: 'secret' },
    { key: 'google_default_model', label: 'Google default model', type: 'string' },
    { key: 'openrouter_api_key', label: 'OpenRouter API key', type: 'secret' },
    { key: 'openrouter_default_model', label: 'OpenRouter default model', type: 'string' },
    { key: 'ollama_base_url', label: 'Ollama base URL', type: 'string', help: 'e.g. http://localhost:11434/v1' },
    { key: 'guest_free_messages', label: 'Free messages before signup', type: 'int' },
    { key: 'signup_bonus_credits', label: 'Signup bonus credits', type: 'int' },
    { key: 'tavily_api_key', label: 'Tavily API key (web search tool)', type: 'secret' },
    { key: 'elevenlabs_api_key', label: 'ElevenLabs API key', type: 'secret' },
    {
      key: 'elevenlabs_voice_id', label: 'ElevenLabs voice ID', type: 'string',
      help: 'Leave blank for the default voice. Only used when an ElevenLabs key is set — without one, read-aloud falls back to the browser voice.',
    },
    {
      key: 'moderation_mode', label: 'Input moderation', type: 'string',
      help: "'wordlist' (default, free), 'ai' (a classifier call per message — catches meaning, costs a little), or 'off'. Only applies to personas with \"Filter offensive input\" ticked.",
    },
    {
      key: 'badword_list', label: 'Blocked words', type: 'text',
      help: 'Comma or newline separated. Replaces the built-in list entirely. Only applies to personas with "Filter offensive input" ticked.',
    },
  ],
  assistant: [
    { key: 'site_assistant_enabled', label: 'Show the assistant bubble', type: 'bool' },
    {
      key: 'site_assistant_persona', label: 'Assistant persona (slug)', type: 'string',
      help: 'The slug of the persona that answers in the bubble — e.g. "support". Its tone, tools, model and guardrails are edited in Personas like any other. Leave blank and no bubble appears.',
    },
    {
      key: 'site_assistant_guest_messages', label: 'Free messages for visitors', type: 'int',
      help: 'How many messages a signed-out visitor may send to the assistant per conversation. Separate from the free persona messages, so asking for help does not use up someone\'s trial. Default 10.',
    },
    { key: 'site_assistant_label', label: 'Bubble label', type: 'string', help: 'Shown on the launcher. Default "Ask us anything".' },
  ],
  email: [
    { key: 'resend_api_key', label: 'Resend API key', type: 'secret' },
    {
      key: 'email_from', label: 'From address', type: 'string',
      help: 'e.g. "Freelee <hello@yourdomain.com>". Both this and the key are required — without them, emails are printed to the server log instead of sent.',
    },
  ],
  billing: [
    { key: 'bank_transfer_details', label: 'Bank transfer instructions', type: 'text' },
    { key: 'invoice_vendor', label: 'Invoice vendor name', type: 'string' },
  ],
  analytics: [
    { key: 'google_analytics_id', label: 'Google Analytics ID', type: 'string' },
  ],
  localization: [
    {
      key: 'frontend_locale', label: 'Frontend (landing site) language', type: 'string',
      help: 'Global, applies to every visitor — not a per-user preference. Valid values: en, pl. See docs/17-translations.md.',
    },
    {
      key: 'admin_locale', label: 'Admin panel language', type: 'string',
      help: 'Global, applies to every admin. Independent of the frontend language above. Valid values: en, pl.',
    },
  ],
} satisfies Record<string, Field[]>;

export type SettingsGroup = keyof typeof SETTINGS_SCHEMA;
