import type { ModuleManifest } from './types';
import { manifest as groupChat } from '@/modules/group-chat/manifest';
import { manifest as crews } from '@/modules/crews/manifest';

/**
 * Static, explicit registry — no filesystem scanning (see
 * docs/08-module-architecture.md for why). This is the single source of
 * truth for what capabilities the platform has, core or optional; per-team
 * enable/disable for `type: 'feature'` entries is DB-backed
 * (`modules`/`moduleTeam` tables, Phase 2) and mirrors this array rather
 * than replacing it.
 *
 * Core entries (`isCore: true`) describe capabilities whose code lives
 * directly in `src/db/schema.ts`/`src/lib/**` rather than under
 * `src/modules/<key>/` — core is load-bearing for every request, not an
 * optional add-on, so it doesn't need the module directory convention.
 * Only `type: 'feature'` modules (first one: group-chat, Phase 6) physically
 * live under `src/modules/`.
 *
 * MANDATORY: every phase that ships a new capability adds its manifest here
 * (or updates its existing one) in the same change — see the "registry +
 * docs" rule in docs/08-module-architecture.md.
 */
export const MODULES: ModuleManifest[] = [
  {
    key: 'teams',
    name: 'Teams / Workspaces',
    version: '1.1.0',
    description:
      'Multi-tenant workspaces — every user has one, owning personas/chats/billing. ' +
      'Three-level authorization (platform/team/resource) and per-team module toggles since 1.1.0.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: {
      capabilities: ['teams.workspace', 'teams.membership', 'teams.authorization', 'teams.module_toggles'],
    },
    permissions: [
      'team.manage_members',
      'team.manage_invitations',
      'team.manage_modules',
      'team.view_billing',
      'team.manage_billing',
      'team.transfer_ownership',
    ],
    navigation: [{ label: 'Team', href: '/dashboard/team', group: 'account', order: 30 }],
  },
  {
    key: 'ai-model-registry',
    name: 'AI Model Registry',
    version: '1.1.0',
    description:
      'DB-backed model catalog (ai_providers/ai_models) replacing the old static PROVIDERS config. ' +
      'New model = INSERT, zero deploy. Providers stay code (drivers); models are pure data. Since ' +
      '1.1.0: live "Fetch models" per provider (no more hand-typed catalogs), a shared grid-picker ' +
      'UI (CardRadioGroup/GridSelect) replacing one-per-line <select> lists, and the first ' +
      'image-generation engines (OpenAI images, Stability AI) — catalog/admin config only, no ' +
      'generation execution yet. Google (Gemini) added as a full chat provider 2026-08-08. ' +
      'See docs/10-ai-model-registry.md, docs/21-image-engines.md and docs/25-google-provider.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['ai.model_catalog', 'ai.tier_resolution', 'ai.live_model_fetch', 'ai.image_engines', 'ai.google_provider'] },
    permissions: [],
    navigation: [{ label: 'AI models', href: '/admin/ai-models', group: 'admin', order: 15 }],
  },
  {
    key: 'persona-versioning',
    name: 'Persona Versioning',
    version: '1.0.0',
    description:
      'Splits personas into identity + persona_versions content. pinVersioning=true personas get a ' +
      'real draft/publish cycle with immutable published versions; pinVersioning=false (default) ' +
      'behaves exactly as before this table existed.',
    type: 'core',
    isCore: true,
    // Not a hard dependency on ai-model-registry — persona_versions.model/
    // modelTier/aiProvider stayed free text this phase (no aiModelId FK, a
    // deliberate scope reduction — see docs/11-persona-versioning.md). Landed
    // after it purely for migration-ordering reasons, not runtime coupling.
    requires: {},
    provides: { capabilities: ['personas.draft_publish', 'personas.immutable_versions'] },
    permissions: [],
  },
  {
    key: 'billing-overhaul',
    name: 'Billing Overhaul',
    version: '1.0.0',
    description:
      'Team-scoped wallets (creditWallets/creditTransactions replace the old per-user users.credits/' +
      'creditLedger), recurring subscriptions (any interval, Stripe-only), time-boxed access passes ' +
      '(entitlements), and raw usage_events. See docs/12-billing-overhaul.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['teams'] },
    provides: {
      capabilities: [
        'billing.team_wallets', 'billing.subscriptions', 'billing.passes',
        'billing.entitlements', 'billing.usage_events',
      ],
    },
    permissions: [],
    navigation: [
      { label: 'Subscription plans', href: '/admin/plans', group: 'admin', order: 20 },
      { label: 'Access passes', href: '/admin/passes', group: 'admin', order: 21 },
    ],
  },
  {
    key: 'data-portability',
    name: 'Data Portability',
    version: '1.0.0',
    description:
      'Export a team\'s full data (personas + version history, crews, conversations, chats, usage) as ' +
      'one JSON bundle; re-import personas/crews back with idempotent externalIdMap-based deduplication. ' +
      'Core, not team-disableable — GDPR-adjacent baseline, not an optional product surface. See docs/15-data-portability.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['teams', 'persona-versioning'] },
    provides: { capabilities: ['portability.export', 'portability.import'] },
    permissions: ['team.export_data'],
    navigation: [{ label: 'Export data', href: '/dashboard/team/export', group: 'account', order: 31 }],
  },
  {
    key: 'marketplace',
    name: 'Marketplace',
    version: '1.0.0',
    description:
      'External vendors (teams) list personas for other teams to install into their own catalog. ' +
      'Free and pay-as-you-go (credit_markup) installs are fully wired; one_off/subscription pricing ' +
      'and real Stripe Connect payouts are schema-ready but deliberately not built this phase. ' +
      'See docs/16-marketplace.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['teams', 'persona-versioning', 'billing-overhaul'] },
    provides: { capabilities: ['marketplace.listings', 'marketplace.install', 'marketplace.reviews'] },
    permissions: ['team.manage_marketplace'],
    navigation: [
      { label: 'Marketplace', href: '/marketplace', group: 'workspace', order: 22 },
      { label: 'Vendor dashboard', href: '/dashboard/vendor', group: 'account', order: 32 },
    ],
  },
  {
    key: 'knowledge-sources',
    name: 'Knowledge Sources',
    version: '1.0.0',
    description:
      'Admin-manageable external RAG/search APIs personas can cite from — replaces a hardcoded ' +
      '{curriculum, universe} record (two other ifairy.co.uk projects\' APIs) wired in directly. ' +
      'Request side (base URL, path, key) is pure data, same pattern as ai_providers; response ' +
      'parsing is a generic dot-path spec instead of one bespoke function per source, covering ' +
      'simple REST/JSON search APIs without a deploy. See docs/18-knowledge-sources.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['knowledge.grounding_sources'] },
    permissions: [],
    navigation: [{ label: 'Knowledge sources', href: '/admin/knowledge-sources', group: 'admin', order: 16 }],
  },
  {
    key: 'translations',
    name: 'Translations',
    version: '2.0.0',
    description:
      'Platform-wide (not team-scoped) site language — one admin-controlled setting for the ' +
      'frontend/landing surface, a separate one for the admin panel. /admin/translations lets an ' +
      'admin add a language by name (AI resolves the code and translates the current word bank, ' +
      '"frozen" until it completes), plus export/import for reviewing translations outside ' +
      'production. Phase 1 (frontend) covers the shared header/footer and the home page; the admin ' +
      'panel setting exists but no admin-panel text is wired up yet (phase 2). Since 2.0.0 the word ' +
      'bank is modular (one file + one AI request per module, failures contained, a locale only ' +
      'unfreezes when every module lands), the extractor scans the tree instead of a stale file list, ' +
      'and export is side-by-side English/target in JSON, CSV or SQL. See docs/17-translations.md and ' +
      'docs/22-modular-word-bank.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['i18n.frontend', 'i18n.admin_settings', 'i18n.add_language', 'i18n.modular_bank', 'i18n.side_by_side_export', 'ui.help_tips'] },
    permissions: [],
    navigation: [{ label: 'Translations', href: '/admin/translations', group: 'admin', order: 25 }],
  },
  {
    key: 'block-builder',
    name: 'Block Builder',
    version: '1.0.0',
    description:
      'The frontpage editor rebuilt as a general block builder: 17 block types, a grid system ' +
      '(width/columns/background/spacing/responsive visibility) stored in its own column so every ' +
      'block inherits it, drag-and-drop reordering via @dnd-kit with full keyboard support, and one ' +
      'level of nesting through a columns container. Adding a block type is a catalog entry plus a ' +
      'render function — the field declarations drive the editing UI and the server-side validation ' +
      'alike. The same blocks build CMS pages and blog posts, with a non-destructive fallback to ' +
      'their markdown. Admins edit blocks on the live page itself, not only from the admin ' +
      'screen — see docs/33-block-builder.md and docs/36-on-page-editing.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['frontpage-sections'] },
    provides: {
      capabilities: ['blocks.catalog', 'blocks.grid_layout', 'blocks.drag_and_drop', 'blocks.nesting', 'blocks.page_scopes', 'blocks.on_page_editing'],
    },
    permissions: [],
    navigation: [{ label: 'Frontpage', href: '/admin/frontpage', group: 'admin', order: 17 }],
  },
  {
    key: 'navigation',
    name: 'Navigation',
    version: '1.0.0',
    description:
      'Nested menus and accessible dropdowns. Before this the schema had no parent_id at all, so the ' +
      'site could not render a dropdown menu; the header selected one flat list. One shared tree ' +
      'builder applies visibility before nesting so the header and footer cannot disagree, orphans ' +
      'are dropped rather than promoted to the top level, and depth is capped at one in the action. ' +
      'See docs/34-navigation.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['navigation.nested_menus', 'navigation.dropdowns'] },
    permissions: [],
    navigation: [{ label: 'Menus', href: '/admin/menus', group: 'admin', order: 18 }],
  },
  {
    key: 'frontpage-sections',
    name: 'Frontpage Sections',
    version: '1.0.0',
    description:
      'Ordered, admin-editable homepage sections (page_sections table) replacing a fixed hardcoded ' +
      'JSX sequence — reorder, hide, and edit hero/how-it-works/CTA/custom sections without a deploy. ' +
      'See docs/19-frontpage-sections.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['frontpage.sections', 'frontpage.custom_sections'] },
    permissions: [],
    navigation: [{ label: 'Frontpage', href: '/admin/frontpage', group: 'admin', order: 17 }],
  },
  {
    key: 'chat-layouts',
    name: 'Chat Layouts',
    version: '1.0.0',
    description:
      'Thirteen category/audience-adaptive chat UIs driven by one engine — seven solo, three group ' +
      '(rooms), three narrative. Narrative layouts change the output itself: the model is prompted for ' +
      'narration/dialogue/action/choices and the reply is parsed and styled back, with the parser ' +
      'failing open to plain prose. Also the first thing that reads the persona capability flags ' +
      '(copy/share/suggestions/voice), which had been stored but unused since Phase 1. ' +
      'Also per-chat conversation controls (tone/writing/output/length, interaction style, how it ' +
      'handles what it does not know), image upload, real image generation, an embeddable widget ' +
      'and word-list input filtering — every persona capability flag now does something. See ' +
      'docs/23-chat-layouts.md, docs/24-chat-controls.md and docs/26-vision-and-images.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['persona-versioning'] },
    provides: { capabilities: ['chat.layouts', 'chat.narrative_output', 'chat.capability_gating', 'chat.conversation_controls', 'chat.vision', 'chat.image_generation', 'chat.embed', 'chat.input_filter'] },
    permissions: [],
  },
  {
    key: 'persona-tools',
    name: 'Tool Calling',
    version: '1.1.0',
    description:
      'Personas can compute and look things up instead of guessing: a safe expression calculator ' +
      '(hand-written shunting-yard parser, no eval), unit conversion, date maths, text stats and dice. ' +
      'Since 1.1.0 also live data — weather (Open-Meteo) and currency rates (Frankfurter/ECB), both ' +
      'keyless, and web search (Tavily) which needs a key and refuses gracefully without one. Tools ' +
      'are suggested per category and stored on the persona version. See docs/29-tools.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['persona-versioning'] },
    provides: { capabilities: ['tools.calculator', 'tools.conversions', 'tools.live_data', 'tools.web_search'] },
    permissions: [],
  },
  {
    key: 'voice',
    name: 'Voice (ElevenLabs)',
    version: '1.1.0',
    description:
      'Text-to-speech via ElevenLabs with a total fallback to the browser\'s own speechSynthesis, so ' +
      'read-aloud never disappears entirely. Since 1.1.0 also speech-to-text via ElevenLabs Scribe, ' +
      'which replaces the Chrome-only SpeechRecognition API with a MediaRecorder upload that works in ' +
      'every current browser; with no key configured it falls back to the old Chrome-only path. ' +
      'See docs/30-voice.md.',
    type: 'integration',
    isCore: false,
    requires: { modules: ['chat-layouts'] },
    provides: { capabilities: ['voice.tts', 'voice.stt'] },
    permissions: [],
  },
  {
    key: 'transactional-email',
    name: 'Transactional Email',
    version: '1.0.0',
    description:
      'A pluggable email transport (Resend, or a log driver that prints the message to the server log) ' +
      'and the first thing that needs it: self-service password reset. Tokens are stored hashed, are ' +
      'single-use, and the request endpoint reports the same result whether or not the address exists, ' +
      'so it cannot be used to enumerate accounts. See docs/31-email-and-password-reset.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['email.send', 'auth.password_reset'] },
    permissions: [],
  },
  {
    key: 'observability',
    name: 'Error Tracking (Sentry)',
    version: '1.0.0',
    description:
      'Optional Sentry integration, entirely inert without a DSN. Events are scrubbed before they ' +
      'leave the box: cookies, authorization headers, request bodies and credential-bearing query ' +
      'strings are removed — `sendDefaultPii: false` alone does not do this, which was found by ' +
      'capturing real envelopes. See docs/32-observability.md.',
    type: 'integration',
    isCore: false,
    requires: {},
    provides: { capabilities: ['observability.error_tracking'] },
    permissions: [],
  },
  {
    key: 'site-assistant',
    name: 'Site Assistant',
    version: '1.0.0',
    description:
      'A chat bubble on every public page that IS a persona — its model, tone, tools, guardrails, ' +
      'capabilities and chat layout are edited in Personas like any other, and it renders the same ' +
      'ChatWindow as the chat page and the embed widget. Free for everyone with its own guest ' +
      'allowance, so asking for help never uses up a trial. Free status is derived server-side from ' +
      'the configured slug and the chat\'s own personaId, never from the request. Also introduces ' +
      'the first rate limiting in this codebase. See docs/37-site-assistant.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['persona-versioning', 'chat-layouts'] },
    provides: { capabilities: ['assistant.bubble', 'assistant.free_support', 'platform.rate_limiting'] },
    permissions: [],
  },
  {
    key: 'showcase',
    name: 'Showcase',
    version: '1.0.0',
    description:
      'Curated examples of real assistant work, shown through a block with a lightbox. Items are ' +
      'promoted from a conversation (the server re-reads the message, so the form cannot supply its ' +
      'own content) or added by hand. Curation is the privacy boundary: nothing a customer generates ' +
      'is published unless an admin chose it, and a promoted prompt arrives hidden until read. ' +
      'See docs/38-showcase.md.',
    type: 'core',
    isCore: true,
    requires: { modules: ['block-builder'] },
    provides: { capabilities: ['showcase.curation', 'showcase.block'] },
    permissions: [],
    navigation: [{ label: 'Showcase', href: '/admin/showcase', group: 'admin', order: 19 }],
  },
  groupChat,
  crews,
];

export function findModule(key: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.key === key);
}
