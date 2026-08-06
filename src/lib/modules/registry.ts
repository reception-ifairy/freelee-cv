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
    version: '1.0.0',
    description:
      'DB-backed model catalog (ai_providers/ai_models) replacing the old static PROVIDERS config. ' +
      'New model = INSERT, zero deploy. Providers stay code (drivers); models are pure data.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['ai.model_catalog', 'ai.tier_resolution'] },
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
    version: '1.0.0',
    description:
      'Platform-wide (not team-scoped) site language — one admin-controlled setting for the ' +
      'frontend/landing surface, a separate one for the admin panel. /admin/translations lets an ' +
      'admin add a language by name (AI resolves the code and translates the current word bank, ' +
      '"frozen" until it completes), plus export/import for reviewing translations outside ' +
      'production. Phase 1 (frontend) covers the shared header/footer and the home page; the admin ' +
      'panel setting exists but no admin-panel text is wired up yet (phase 2). See docs/17-translations.md.',
    type: 'core',
    isCore: true,
    requires: {},
    provides: { capabilities: ['i18n.frontend', 'i18n.admin_settings', 'i18n.add_language'] },
    permissions: [],
    navigation: [{ label: 'Translations', href: '/admin/translations', group: 'admin', order: 25 }],
  },
  groupChat,
  crews,
];

export function findModule(key: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.key === key);
}
