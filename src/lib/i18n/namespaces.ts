/**
 * The word bank is **modular**: every translation key is `<namespace>.<name>`,
 * and the namespace prefix is the module it belongs to. This is not
 * cosmetic — it's what makes the bank tractable:
 *
 *  - The AI translation pipeline translates **one module per request**
 *    instead of one giant blob. A 500-key single prompt drifts, truncates,
 *    and silently drops keys; 8 focused requests of ~60 keys each do not.
 *  - A coworker can be handed one module to review (`i18n/blog.en.json`)
 *    without touching the rest.
 *  - A partial failure is contained — if `blog` fails to translate, `home`
 *    is still complete and live.
 *
 * No `@/db` import here (plain constants) so client components and scripts
 * can both read it — same split as `src/lib/ai/provider-ids.ts`.
 */

/** Public/marketing/app surface — everything a visitor or logged-in user sees. */
export const FRONTEND_NAMESPACES = [
  'common', // shared verbs and states: Save, Cancel, Loading, Search…
  'nav', // header, footer, menus
  'home', // the frontpage sections
  'blog', // blog index + single post
  'pages', // CMS pages (`/[slug]`)
  'personas', // persona catalog + detail
  'pricing', // pricing/credit packs
  'auth', // login, register, account errors
  'help', // "?" help-tip titles and bodies
] as const;

/** The admin console. Separate because it has its own independent language setting. */
export const ADMIN_NAMESPACES = ['admin'] as const;

export type FrontendNamespace = (typeof FRONTEND_NAMESPACES)[number];
export type AdminNamespace = (typeof ADMIN_NAMESPACES)[number];
export type Namespace = FrontendNamespace | AdminNamespace;

export const ALL_NAMESPACES: readonly Namespace[] = [...FRONTEND_NAMESPACES, ...ADMIN_NAMESPACES];

/** Human labels for the admin panel's per-module progress table. */
export const NAMESPACE_LABELS: Record<Namespace, string> = {
  common: 'Common',
  nav: 'Navigation',
  home: 'Home page',
  blog: 'Blog',
  pages: 'CMS pages',
  personas: 'Personas',
  pricing: 'Pricing',
  auth: 'Sign in / sign up',
  help: 'Help tips',
  admin: 'Admin panel',
};

export function isNamespace(value: string): value is Namespace {
  return (ALL_NAMESPACES as readonly string[]).includes(value);
}

/**
 * `home.hero_title` → `home`. The single rule the whole modular system rests
 * on, so it lives in one place: a key whose prefix isn't a known namespace
 * falls back to `common` rather than being dropped — a mis-prefixed key
 * should still be translatable, not silently invisible.
 */
export function namespaceOfKey(key: string): Namespace {
  const prefix = key.split('.')[0];
  return isNamespace(prefix) ? prefix : 'common';
}

export function bankPath(namespace: Namespace): string {
  return `i18n/${namespace}.en.json`;
}
