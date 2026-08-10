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
 * custom screens (AI models, Branding) that render their own component.
 */

import type { SettingsGroup } from '@/lib/settings-schema';

export type SettingsSection = {
  id: string;
  label: string;
  description: string;
  /** Curated icon key, resolved in the nav — same trade-off as branding fonts. */
  icon: 'sliders' | 'globe' | 'chart' | 'cpu' | 'layers' | 'bot' | 'mail' | 'card' | 'palette';
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
    ],
  },
  {
    heading: 'AI',
    blurb: 'Providers, the models they expose, and the assistant on the public site.',
    sections: [
      { id: 'ai', label: 'Providers & keys', description: 'API keys and the default model tier every persona falls back to.', icon: 'cpu', schemaGroup: 'ai' },
      { id: 'models', label: 'Models', description: 'The catalog each provider exposes — tiers, pricing and availability.', icon: 'layers' },
      { id: 'assistant', label: 'Site assistant', description: 'The chat bubble on every public page.', icon: 'bot', schemaGroup: 'assistant' },
    ],
  },
  {
    heading: 'Money & messages',
    blurb: 'How customers pay, and how the site talks to them.',
    sections: [
      { id: 'billing', label: 'Billing', description: 'Currency, gateway keys and checkout behaviour.', icon: 'card', schemaGroup: 'billing' },
      { id: 'email', label: 'Email', description: 'Who sends transactional mail, and from where.', icon: 'mail', schemaGroup: 'email' },
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
