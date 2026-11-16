/**
 * The settings map.
 *
 * Settings had grown into a flat strip of seven lowercase words — "general ai
 * assistant email billing analytics localization" — with no grouping, no
 * explanation, and AI models living on a completely separate page despite
 * being the same job. This turns the navigation into data: grouped, described,
 * and ordered on purpose.
 *
 * Plain module: read by the settings page (server) and its nav (client).
 *
 * `schemaGroup` links a section to `SETTINGS_SCHEMA`; sections without one are
 * custom screens (AI models, Media storage, Branding) that render their own
 * component. Connection cards (Save → Test → Fetch) are placed per section by
 * the settings page itself.
 */

import type { SettingsGroup } from '@/lib/settings-schema';
import { CONNECTION_GROUPS, INTEGRATIONS_SECTION, integrationsSectionId } from '@/lib/admin/connection-groups';

export type SettingsSection = {
  id: string;
  label: string;
  description: string;
  /** Curated icon key, resolved in the nav — same trade-off as branding fonts. */
  icon: 'sliders' | 'globe' | 'chart' | 'storage' | 'cpu' | 'layers' | 'bot' | 'mail' | 'card' | 'palette' | 'plug' | 'shield' | 'sparkles' | 'wrench' | 'book';
  /** The `SETTINGS_SCHEMA` group this renders, when it is a plain settings form. */
  schemaGroup?: SettingsGroup;
  /** Set when the section lives on its own route rather than inside settings. */
  href?: string;
};

export type SettingsGroupBlock = {
  heading: string;
  blurb: string;
  sections: SettingsSection[];
};

const INTEGRATION_ICONS: Record<string, SettingsSection['icon']> = {
  ai: 'sparkles',
  tools: 'wrench',
  knowledge: 'book',
  email: 'mail',
  payments: 'card',
  storage: 'storage',
};

/** Whether a section is one of Settings → Integrations (all, or one group). */
export const isIntegrationsSection = (id: string) => id === INTEGRATIONS_SECTION || id.startsWith(`${INTEGRATIONS_SECTION}-`);

export const SETTINGS_MAP: SettingsGroupBlock[] = [
  {
    heading: 'Platform',
    blurb: 'What the site is called, where it is, and who is watching.',
    sections: [
      { id: 'general', label: 'General', description: 'Site name, description, support address, registrations.', icon: 'sliders', schemaGroup: 'general' },
      { id: 'localization', label: 'Language', description: 'Site language and how dates and numbers are written.', icon: 'globe', schemaGroup: 'localization' },
      { id: 'analytics', label: 'Analytics', description: 'Tracking identifiers, if you use any.', icon: 'chart', schemaGroup: 'analytics' },
    ],
  },
  {
    heading: 'AI',
    blurb: 'What bots fall back to, the models customers can use, safety, and the assistant on the public site.',
    sections: [
      { id: 'ai', label: 'AI defaults', description: 'The model each provider uses when a bot has none of its own, the fallback provider, and the model of the category agents.', icon: 'cpu', schemaGroup: 'ai' },
      { id: 'models', label: 'Models', description: 'Which models customers can use, their tier and price, and the Knowledgebase embedding model.', icon: 'layers' },
      { id: 'safety', label: 'Safety', description: 'How messages are checked before a bot answers: moderation and blocked words.', icon: 'shield', schemaGroup: 'ai' },
      { id: 'assistant', label: 'Site assistant', description: 'The chat bubble on every public page.', icon: 'bot', schemaGroup: 'assistant' },
    ],
  },
  {
    heading: 'Money & messages',
    blurb: 'How customers pay, what they get free, and how the site writes to them.',
    sections: [
      { id: 'billing', label: 'Billing', description: 'Bank transfer and invoice details, and what visitors and new accounts get for free.', icon: 'card', schemaGroup: 'billing' },
      { id: 'email', label: 'Email', description: 'The address mail is sent from.', icon: 'mail', schemaGroup: 'email' },
    ],
  },
  {
    // Owner, 2026-11-16: "integrations should live in Settings". The keys and
    // outside services (Connections until #93), one section per group.
    heading: 'Integrations',
    blurb: 'Keys and outside services: save a key, press Test, and Fetch where there is something to bring in.',
    sections: [
      { id: INTEGRATIONS_SECTION, label: 'All integrations', description: 'Every key and outside service, with whether it works.', icon: 'plug' },
      ...CONNECTION_GROUPS.map((group) => ({
        id: integrationsSectionId(group.id),
        label: group.heading,
        description: group.blurb,
        icon: INTEGRATION_ICONS[group.id] ?? ('plug' as const),
      })),
    ],
  },
  {
    heading: 'Appearance',
    blurb: 'Configured on its own page.',
    sections: [{ id: 'branding', label: 'Branding & theme', description: 'Palette, logo, favicon and fonts.', icon: 'palette', href: '/admin/theme' }],
  },
];

/**
 * The settings keys each section edits, and so the one place each key lives
 * (2026-11-14). The page renders exactly these; keys belonging to a
 * connection (a provider's key, the curriculum's address) live in
 * Settings → Integrations instead (/admin/connections until #93), and `scripts/verify-settings-map.ts` checks
 * that every key in SETTINGS_SCHEMA has exactly one home.
 *
 * Free use moved from AI to Billing: what a visitor gets for nothing is a
 * pricing decision. Its keys stay in the `ai` schema group (the settings rows
 * keep their group), the section is what moved.
 */
export const SECTION_FIELDS: Record<string, readonly string[]> = {
  general: ['site_name', 'site_description', 'support_email', 'allow_registration'],
  localization: ['frontend_locale', 'admin_locale'],
  analytics: ['google_analytics_id'],
  ai: ['openai_default_model', 'anthropic_default_model', 'google_default_model', 'openrouter_default_model', 'ai_default_provider', 'category_agent_model'],
  safety: ['moderation_mode', 'badword_list'],
  assistant: ['site_assistant_enabled', 'site_assistant_persona', 'site_assistant_guest_messages', 'site_assistant_label', 'site_assistant_tools'],
  billing: ['bank_transfer_details', 'invoice_vendor', 'guest_free_messages', 'signup_bonus_credits'],
  email: ['email_from'],
};

/** Old section ids that moved off this page, and where they went. */
export const MOVED_SECTIONS: Record<string, string> = {
  storage: '/admin/settings?section=integrations-storage&open=s3',
  connections: '/admin/settings?section=integrations',
};

export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_MAP.flatMap((group) => group.sections);

export function settingsSection(id: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id);
}

export const DEFAULT_SECTION = 'general';
