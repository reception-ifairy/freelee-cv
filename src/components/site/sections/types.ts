/**
 * `config` shapes for the section types that actually carry admin-editable
 * content — `categories`/`featured_personas`/`pricing`/`blog` have none
 * (pure DB-driven display, their copy stays translation-driven via
 * `getFrontendT()` exactly as before this system existed — see
 * docs/19-frontpage-sections.md for why that boundary was drawn there).
 */

export type HeroConfig = {
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export type CtaConfig = {
  title: string;
  subtitle: string;
  buttonLabel: string;
};

/** Curated set, not an arbitrary icon-name string — same "fixed small set" trade-off as branding fonts. Resolved to a real icon in how-it-works.tsx's STEP_ICONS. */
export const STEP_ICON_KEYS = ['users', 'message-square', 'bolt', 'sparkles', 'shield', 'heart'] as const;
export type HowItWorksStep = { icon: (typeof STEP_ICON_KEYS)[number]; title: string; body: string };
export type HowItWorksConfig = { steps: HowItWorksStep[] };

export type CustomContentConfig = {
  heading: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  titleLead: 'Your AI agency, ',
  titleAccent: 'staffed by personas',
  subtitle: 'Hire a specialist for every task.',
  primaryLabel: 'Browse personas',
  secondaryLabel: 'See pricing',
};

export const DEFAULT_CTA_CONFIG: CtaConfig = {
  title: 'Start with free credits',
  subtitle: 'Create an account and get {credits} credits to try every persona — no card required.',
  buttonLabel: 'Create free account',
};

export const DEFAULT_HOW_IT_WORKS_CONFIG: HowItWorksConfig = {
  steps: [
    { icon: 'users', title: 'Pick a persona', body: 'Each persona carries its own expertise and tone.' },
    { icon: 'message-square', title: 'Talk naturally', body: 'Replies stream in as they are written.' },
    { icon: 'bolt', title: 'Pay per use', body: 'Credits are deducted per message. No subscription.' },
  ],
};

export const DEFAULT_CUSTOM_CONTENT_CONFIG: CustomContentConfig = {
  heading: 'New section',
  body: 'Write something here.',
};
