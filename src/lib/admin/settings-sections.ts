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

export type SettingsSection = {
  id: string;
  label: string;
  description: string;
  /** Curated icon key, resolved in the nav — same trade-off as branding fonts. */
  icon: 'sliders' | 'globe' | 'chart' | 'storage' | 'cpu' | 'layers' | 'bot' | 'mail' | 'card' | 'palette';
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

export const SETTINGS_MAP: SettingsGroupBlock[] = [
  {
    heading: 'Platform',
    blurb: 'What the site is called, where it is, and who is watching.',
    sections: [
      { id: 'general', label: 'General', description: 'Site name, description, support address, registrations.', icon: 'sliders', schemaGroup: 'general' },
      { id: 'localization', label: 'Language', description: 'Site language and how dates and numbers are written.', icon: 'globe', schemaGroup: 'localization' },
      { id: 'analytics', label: 'Analytics', description: 'Tracking identifiers, if you use any.', icon: 'chart', schemaGroup: 'analytics' },
      // No schemaGroup: the bucket is configured in the server's env file on
      // purpose, so this section is a read-only card with a Test button.
      { id: 'storage', label: 'Media storage', description: 'Where uploaded and generated images are kept, and a check that the bucket answers.', icon: 'storage' },
    ],
  },
  {
    heading: 'AI',
    blurb: 'Providers, the models they expose, and the assistant on the public site.',
    sections: [
      { id: 'ai', label: 'Providers & keys', description: 'Save a key, Test it, then Fetch its models. Also web search, voice, and the defaults bots fall back to.', icon: 'cpu', schemaGroup: 'ai' },
      { id: 'models', label: 'Models', description: 'Which models customers can use, their tier and price, and the Knowledgebase embedding model.', icon: 'layers' },
      { id: 'assistant', label: 'Site assistant', description: 'The chat bubble on every public page.', icon: 'bot', schemaGroup: 'assistant' },
    ],
  },
  {
    heading: 'Money & messages',
    blurb: 'How customers pay, and how the site talks to them.',
    sections: [
      { id: 'billing', label: 'Billing', description: 'Check that Stripe and PayPal answer, and set bank transfer and invoice details.', icon: 'card', schemaGroup: 'billing' },
      { id: 'email', label: 'Email', description: 'The Resend connection, and the address mail is sent from.', icon: 'mail', schemaGroup: 'email' },
    ],
  },
  {
    heading: 'Appearance',
    blurb: 'How the site looks.',
    sections: [
      { id: 'branding', label: 'Branding & theme', description: 'Palette, logo, favicon and fonts.', icon: 'palette', href: '/admin/theme' },
    ],
  },
];

export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_MAP.flatMap((group) => group.sections);

export function settingsSection(id: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id);
}

export const DEFAULT_SECTION = 'general';
