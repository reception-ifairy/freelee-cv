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
    { key: 'openrouter_api_key', label: 'OpenRouter API key', type: 'secret' },
    { key: 'openrouter_default_model', label: 'OpenRouter default model', type: 'string' },
    { key: 'ollama_base_url', label: 'Ollama base URL', type: 'string', help: 'e.g. http://localhost:11434/v1' },
    { key: 'guest_free_messages', label: 'Free messages before signup', type: 'int' },
    { key: 'signup_bonus_credits', label: 'Signup bonus credits', type: 'int' },
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
