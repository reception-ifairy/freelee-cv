import {
  pgTable, text, integer, bigint, boolean, timestamp, jsonb, real, date,
  uniqueIndex, index, primaryKey, pgEnum, serial, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* ---------------------------------------------------------------------------
 * Enums live in the database, not as loose strings, so an invalid status is
 * rejected by Postgres rather than only by application code.
 * ------------------------------------------------------------------------- */
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'failed', 'refunded', 'cancelled']);
export const ledgerType = pgEnum('ledger_type', ['purchase', 'bonus', 'spend', 'refund', 'adjustment']);
export const messageRole = pgEnum('message_role', ['system', 'user', 'assistant']);
export const messageStatus = pgEnum('message_status', ['streaming', 'complete', 'failed']);
export const modifierType = pgEnum('modifier_type', ['tone', 'writing', 'output', 'length', 'audience']);
export const menuLocation = pgEnum('menu_location', ['header', 'footer', 'legal']);
export const menuVisibility = pgEnum('menu_visibility', ['all', 'guest', 'auth', 'admin']);
export const audienceType = pgEnum('audience_type', ['B2B', 'B2C', 'B2G']);
export const settingType = pgEnum('setting_type', ['string', 'text', 'bool', 'int', 'float', 'json', 'secret']);

// Cognitive knobs ported from the Personat.AI blueprint engine — control how a
// persona reasons and phrases itself, independent of raw model parameters.
export const interactionStyle = pgEnum('interaction_style', [
  'formal', 'casual', 'enthusiastic', 'concise', 'socratic',
]);
export const approachToUnknown = pgEnum('approach_to_unknown', [
  'admit_ignorance', 'educated_guess', 'ask_clarifying',
]);
export const promptTechnique = pgEnum('prompt_technique', ['direct', 'chain_of_thought']);

// UK marketplace taxonomy — small, genuinely closed vocabularies (unlike
// personas.modelTier, which is plain text specifically to dodge a schema
// migration when the model lineup grows), so a real enum is appropriate here.
export const riskLevel = pgEnum('risk_level', ['R0', 'R1', 'R2', 'R3']);
export const narrativeFit = pgEnum('narrative_fit', ['low', 'medium', 'high', 'very_high']);

// Teams/workspaces — small, closed vocabularies, same reasoning as riskLevel/
// narrativeFit above (unlike personas.modelTier or teams.planKey, which are
// plain text specifically because that vocabulary is expected to churn).
export const teamRole = pgEnum('team_role', ['owner', 'admin', 'member', 'guest']);
export const teamAiMode = pgEnum('team_ai_mode', ['platform', 'byok', 'hybrid']);
export const personaVisibility = pgEnum('persona_visibility', ['private', 'team', 'unlisted', 'public']);

// Module registry (src/lib/modules/registry.ts) — same small-closed-vocab reasoning.
export const moduleType = pgEnum('module_type', ['core', 'feature', 'admin', 'integration']);
export const moduleStatus = pgEnum('module_status', ['installed', 'disabled', 'blocked']);

// AI model registry (src/lib/ai/registry.ts).
export const aiModelStatus = pgEnum('ai_model_status', ['preview', 'stable', 'deprecated', 'retired']);
// Image-generation engines (docs/21-image-engines.md) — 'text' is every existing row's default,
// zero behavior change for chat; 'image' models never appear in a persona's model picker.
export const aiModelModality = pgEnum('ai_model_modality', ['text', 'image']);
// Persona versioning (docs/11-persona-versioning.md).
export const personaVersionStatus = pgEnum('persona_version_status', ['draft', 'published', 'deprecated']);
// BYOK (Phase 5) — declared now so provider_credentials doesn't need a later migration.
export const credentialScope = pgEnum('credential_scope', ['platform', 'team', 'user']);

// Billing overhaul (docs/12-billing-overhaul.md) — subscriptions, time-boxed
// passes, entitlements, team-scoped wallets. Small closed vocabularies, same
// reasoning as elsewhere in this file.
export const planInterval = pgEnum('plan_interval', ['day', 'week', 'month', 'year']);
export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'incomplete',
]);
export const passDurationUnit = pgEnum('pass_duration_unit', ['hour', 'day', 'week', 'month']);
export const entitlementSourceType = pgEnum('entitlement_source_type', [
  'subscription', 'pass', 'purchase', 'grant', 'trial', 'marketplace',
]);
export const entitlementTargetType = pgEnum('entitlement_target_type', [
  'platform', 'persona', 'module', 'model', 'feature',
]);
export const walletOwnerType = pgEnum('wallet_owner_type', ['team', 'user']);
export const creditTransactionType = pgEnum('credit_transaction_type', [
  'purchase', 'bonus', 'spend', 'refund', 'adjustment', 'subscription_grant', 'transfer',
]);
export const orderKind = pgEnum('order_kind', ['credit_pack', 'subscription', 'pass']);

/* ---------------------------------------------------------------------------
 * Shapes stored inside jsonb columns. Declaring them with $type<> means the
 * compiler checks every read and write — jsonb is not an escape hatch here.
 * ------------------------------------------------------------------------- */
export type PersonaCapabilities = {
  vision?: boolean; images?: boolean; voiceIn?: boolean; voiceOut?: boolean;
  share?: boolean; copy?: boolean; embed?: boolean; suggestions?: boolean;
  badwordFilter?: boolean; tone?: boolean; writing?: boolean; output?: boolean;
};

export const PERSONALITY_TRAITS = [
  'warmth', 'humor', 'formality', 'curiosity', 'patience',
  'directness', 'creativity', 'rigor', 'encouragement', 'storytelling',
] as const;

export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];
export type PersonaPersonality = Partial<Record<PersonalityTrait, number>>;
export type ThemeTokens = Record<string, string>;

/**
 * Deep persona blueprint ported from the Personat.AI cognitive-architecture
 * engine. Optional and additive: when present it is compiled into the system
 * prompt ahead of the flat fields (name/expertise/personality) rather than
 * replacing them, so every existing persona keeps working unchanged.
 */
export type PersonaBlueprint = {
  identity?: {
    shortDescription?: string;
    welcomeMessageTemplate?: string;
    expertProfile?: {
      domainOfExpertise?: string;
      specialization?: string;
      generalFunctionAsAi?: string;
      coreOperatingProtocolSummary?: string;
      keyKnowledgeAreas?: string[];
    };
  };
  personalityAndNarrativeProfile?: {
    personalityTraits?: string[];
    coreInteractionStyle?: string;
    emotionalRangeRepresentation?: string;
    motivations?: string[];
    interests?: string[];
    favoriteQuotesOrSayings?: string[];
    catchphrases?: string[];
    humorProfile?: { levelAndStyle?: string; examples?: string[] };
    relationshipToUser?: string;
  };
  communicationProfile?: {
    primaryLanguageSettings?: { defaultLanguageCode?: string; languageLevelAdaptationDescription?: string };
    speechCharacteristics?: { overallSpeechStyle?: string; voiceAttributes?: string };
    writingStyle?: { overallStyle?: string; examples?: string[] };
    clarityTechniques?: { useOfAnalogiesOrComparisons?: string; encouragementAndPositiveFraming?: string };
  };
  interactionAndPedagogyProfile?: {
    coreTeachingOrGuidanceMethodology?: string;
    interactionStyleSummary?: string;
    learningOrGoalObjectives?: { primaryGoals?: string[]; secondaryGoals?: string[] };
    lessonOrInteractionStructure?: { defaultLengthOrFormat?: string };
    feedbackAndSupportSystems?: { feedbackMechanisms?: string[]; emotionalIntelligenceCapabilities?: string };
  };
  contentIntegrityAndSafety?: {
    factualAccuracyApproach?: string;
    ethicalInteractionPrinciples?: string;
    handlingSensitiveOrTabooTopics?: string;
  };
  finalStatements?: {
    disclaimerOrSafetyNotes?: string;
  };
};

/* ============================ Auth & accounts ============================ */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    passwordHash: text('password_hash'),
    image: text('image'),
    locale: text('locale').notNull().default('en'),

    // Cached balance. `creditLedger` is the source of truth.
    credits: integer('credits').notNull().default(0),
    lifetimePurchased: integer('lifetime_purchased').notNull().default(0),
    lifetimeSpent: integer('lifetime_spent').notNull().default(0),

    isActive: boolean('is_active').notNull().default(true),
    isAdmin: boolean('is_admin').notNull().default(false),
    timezone: text('timezone').notNull().default('UTC'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    // `isAdmin` above is unrelated and keeps meaning platform admin, not a team role.
    defaultTeamId: text('default_team_id').notNull()
      .references((): AnyPgColumn => teams.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    index('users_active_idx').on(t.isActive, t.createdAt),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ========================== Teams / workspaces ============================
 * Every user has exactly one implicit "personal team" created at registration
 * — a workspace of one, not a special case — so multi-member teams are just
 * personal teams that grew a second member, and every later feature (billing,
 * model allowlists, module toggles) can be written once against `teamId`
 * without branching on "is this a solo user or an organisation." See
 * drizzle/0005_teams_foundation.sql + 0006_teams_not_null.sql for the retrofit
 * of teamId onto personas/chats/orders/creditLedger.
 * ------------------------------------------------------------------------- */

export const teams = pgTable(
  'teams',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ownerId: text('owner_id').notNull().references(() => users.id),

    // Plain text, not an enum — plan names churn faster than a migration
    // should follow (same reasoning as personas.modelTier).
    planKey: text('plan_key').notNull().default('free'),
    aiMode: teamAiMode('ai_mode').notNull().default('platform'),

    seatsLimit: integer('seats_limit').notNull().default(1),
    monthlyCreditGrant: integer('monthly_credit_grant').notNull().default(0),
    dataRetentionDays: integer('data_retention_days'),
    zeroRetention: boolean('zero_retention').notNull().default(false),

    country: text('country').notNull().default('GB'),
    vatNumber: text('vat_number'),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('teams_slug_idx').on(t.slug),
    index('teams_owner_idx').on(t.ownerId),
  ],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: teamRole('role').notNull().default('member'),

    // Granular overrides on top of the role's defaults — see src/lib/auth/permissions.ts.
    permissions: jsonb('permissions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    monthlyCreditCap: integer('monthly_credit_cap'),
    modelAllowlist: jsonb('model_allowlist').$type<string[]>(),

    invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('team_members_team_user_idx').on(t.teamId, t.userId),
    index('team_members_user_idx').on(t.userId),
  ],
);

export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: teamRole('role').notNull().default('member'),
    permissions: jsonb('permissions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    token: text('token').notNull(),
    invitedBy: text('invited_by').notNull().references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('team_invitations_token_idx').on(t.token),
    index('team_invitations_team_idx').on(t.teamId),
    index('team_invitations_email_idx').on(t.email),
  ],
);

/* =============================== Modules ==================================
 * DB-backed mirror of src/lib/modules/registry.ts's MODULES array — seeded
 * from it (src/lib/modules/sync.ts), not user-editable directly. Exists so
 * the admin/team-settings UI and moduleTeam FKs have something to query
 * without importing the registry module into every render path. See
 * docs/08-module-architecture.md.
 * ------------------------------------------------------------------------- */

export const modules = pgTable(
  'modules',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    version: text('version').notNull(),
    description: text('description').notNull().default(''),
    type: moduleType('type').notNull(),
    isCore: boolean('is_core').notNull().default(false),
    requires: jsonb('requires').$type<{ modules?: string[]; capabilities?: string[] }>().notNull().default(sql`'{}'::jsonb`),
    provides: jsonb('provides').$type<{ capabilities?: string[]; events?: string[] }>().notNull().default(sql`'{}'::jsonb`),
    permissions: jsonb('permissions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    navigation: jsonb('navigation').$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
    status: moduleStatus('status').notNull().default('installed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('modules_key_idx').on(t.key)],
);

export const moduleTeam = pgTable(
  'module_team',
  {
    id: serial('id').primaryKey(),
    moduleId: integer('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    // isCore modules have no row here at all — they're always enabled (see
    // src/lib/modules/db.ts's isModuleEnabledForTeam).
    enabled: boolean('enabled').notNull().default(true),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull().defaultNow(),
    enabledBy: text('enabled_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('module_team_module_team_idx').on(t.moduleId, t.teamId),
    index('module_team_team_idx').on(t.teamId),
  ],
);

/* ============================= AI registry =================================
 * DB-backed mirror of what used to be the static `PROVIDERS` const in
 * src/lib/ai/registry.ts. `aiProviders.key`/`aiModels.modelId` (text) are the
 * actual runtime lookup keys — same strings the old static config used
 * (`'openai'`, `'gpt-4o'`, …) — the integer PKs are only for admin CRUD/FKs.
 * See docs/10-ai-model-registry.md.
 * ------------------------------------------------------------------------- */

export const aiProviders = pgTable(
  'ai_providers',
  {
    id: serial('id').primaryKey(),
    // Text, not enum — same reasoning as orders.gateway: a small fixed set,
    // but each value still requires a driver branch in getModel(), so a new
    // provider is a code change regardless of the column type.
    key: text('key').notNull(),
    label: text('label').notNull(),
    supports: jsonb('supports').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    defaultModel: text('default_model').notNull(),
    apiKeyEnv: text('api_key_env').notNull(),
    baseUrlEnv: text('base_url_env'),
    fallbackBaseUrl: text('fallback_base_url'),
    sort: integer('sort').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('ai_providers_key_idx').on(t.key)],
);

export const aiModels = pgTable(
  'ai_models',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id').notNull().references(() => aiProviders.id, { onDelete: 'cascade' }),
    /** Exact API string, e.g. "gpt-4o" — the only place a model name string is allowed to live. */
    modelId: text('model_id').notNull(),
    label: text('label').notNull(),
    /** 'fast' | 'balanced' | 'advanced' | null — null means not offered on the tier picker. */
    tier: text('tier'),
    creditsPer1k: integer('credits_per_1k').notNull(),
    status: aiModelStatus('status').notNull().default('stable'),
    modality: aiModelModality('modality').notNull().default('text'),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_models_provider_model_idx').on(t.providerId, t.modelId),
    index('ai_models_status_idx').on(t.status),
  ],
);

/** Parked — no reader or writer yet. Wired up in Phase 5 (per-team allowlist/markup). */
export const aiModelTeam = pgTable(
  'ai_model_team',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    aiModelId: integer('ai_model_id').notNull().references(() => aiModels.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    markupPct: real('markup_pct'),
    dailyTokenCap: integer('daily_token_cap'),
  },
  (t) => [uniqueIndex('ai_model_team_idx').on(t.teamId, t.aiModelId)],
);

/** Parked — no reader or writer yet. Wired up in Phase 5 (BYOK). */
export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    providerId: integer('provider_id').notNull().references(() => aiProviders.id, { onDelete: 'cascade' }),
    scope: credentialScope('scope').notNull().default('team'),
    label: text('label'),
    // Not yet written by any code path — Phase 5 encrypts with APP_KEY-equivalent before insert.
    encryptedKey: text('encrypted_key'),
    keyLast4: text('key_last4'),
    status: text('status').notNull().default('unverified'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provider_credentials_team_idx').on(t.teamId)],
);

/**
 * Replaces what used to be a hardcoded `{ curriculum, universe }` record in
 * `src/lib/knowledge/registry.ts` — two specific external-project RAG APIs
 * (curriculum.ifairy.co.uk, universe.ifairy.co.uk) wired in directly, each
 * with its own bespoke response-parsing function. Removed 2026-08-06 in
 * favor of this: any REST/JSON search API an admin can point a URL and key
 * at, added from `/admin/knowledge-sources`, no deploy.
 *
 * The request side is genuinely just data (base URL, path, key) — same
 * pattern as `aiProviders`. The response side can't be, in general
 * (arbitrary APIs return arbitrarily-shaped JSON) — but a **dot-path
 * spec** (`resultsPath`/`titlePath`/`textPath`/`citationPath`, e.g.
 * `"data.results"` / `"chunk.text"`) covers the realistic common case (a
 * results array, each hit a flat-or-lightly-nested object) without needing
 * a bespoke parser function per source. An API with a genuinely different
 * shape (paginated, GraphQL, multi-step auth) still needs real code — this
 * is explicitly the "simple case, zero deploy" 80%, not a universal
 * adapter. See docs/18-knowledge-sources.md.
 */
export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    baseUrl: text('base_url').notNull(),
    path: text('path').notNull().default('/v1/search'),
    apiKey: text('api_key'),
    /** Optional extra field sent alongside `query`/`k` in the POST body — kept from the two original sources' shape, not required. */
    grant: text('grant'),
    resultsPath: text('results_path').notNull().default('data.results'),
    titlePath: text('title_path').notNull().default('title'),
    textPath: text('text_path').notNull().default('text'),
    citationPath: text('citation_path').notNull().default('sourceUrl'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('knowledge_sources_key_idx').on(t.key)],
);

export type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSourceRow = typeof knowledgeSources.$inferInsert;

/* ============================== Personas ================================= */

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    color: text('color'),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** UK market/regulatory context — see docs/uk-marketplace-taxonomy-extract.md. */
    ukMarketSize: text('uk_market_size'),
    ukGrowthRate: text('uk_growth_rate'),
    ukKeyRegulations: jsonb('uk_key_regulations').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ukIndustryBodies: jsonb('uk_industry_bodies').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    defaultRiskLevel: riskLevel('default_risk_level'),
    narrativePotential: narrativeFit('narrative_potential'),
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug)],
);

export const sectors = pgTable(
  'sectors',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    /** Stable natural key from the source taxonomy, e.g. "CAT-03-SEC-01" — used for idempotent backfill upserts. */
    code: text('code'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    b2cSuitability: integer('b2c_suitability').notNull().default(50),
    b2bSuitability: integer('b2b_suitability').notNull().default(50),
    b2gSuitability: integer('b2g_suitability').notNull().default(50),
    typicalRiskLevel: riskLevel('typical_risk_level'),
    narrativeFit: narrativeFit('narrative_fit'),
    primaryInteractionModes: jsonb('primary_interaction_modes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sectors_category_slug_idx').on(t.categoryId, t.slug),
    uniqueIndex('sectors_code_idx').on(t.code),
    index('sectors_category_idx').on(t.categoryId),
  ],
);

export const personas = pgTable(
  'personas',
  {
    id: serial('id').primaryKey(),

    // Ownership (who can edit this persona) is independent of `visibility`
    // below (who can browse/chat with it); all 147 pre-teams personas were
    // backfilled onto the platform team and stayed `visibility: 'public'`,
    // so the catalog was unaffected by this column's introduction.
    teamId: text('team_id').notNull().references(() => teams.id),
    visibility: personaVisibility('visibility').notNull().default('public'),

    name: text('name').notNull(),
    slug: text('slug').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    expertise: text('expertise'),
    avatar: text('avatar'),
    accentColor: text('accent_color').notNull().default('#6366f1'),

    // Nullable, not the usual "backfill then NOT NULL" (see drizzle/0006) —
    // personas.id and persona_versions.id are both `serial`, not client-
    // generated uuids, so there's no id to pre-choose for a deferrable FK
    // pair the way teams/users did it. Instead: insert the persona row,
    // insert its version row (personaId now known), then UPDATE
    // currentVersionId — three statements in one transaction, no circular
    // NOT NULL. "Every persona has a current version" is an application
    // invariant (every creation path does exactly this) rather than a DB
    // constraint. See docs/11-persona-versioning.md.
    currentVersionId: integer('current_version_id').references((): AnyPgColumn => personaVersions.id, { onDelete: 'set null' }),
    /** Set only when pinVersioning is true and an edit is in progress. */
    draftVersionId: integer('draft_version_id').references((): AnyPgColumn => personaVersions.id, { onDelete: 'set null' }),
    /** Default false: editing mutates the current version in place, exactly like before this table existed. */
    pinVersioning: boolean('pin_versioning').notNull().default(false),
    /**
     * Parked (Phase 5) — schema-ready, not enforced anywhere yet. Would gate
     * this persona behind a subscription of `plans.tier >= minPlanTier`, on
     * top of (not instead of) `isPremium`/`creditsPerMessage`. Enforcement is
     * a real new authorization surface deliberately deferred — see
     * docs/12-billing-overhaul.md.
     */
    minPlanTier: integer('min_plan_tier'),

    // Deprecated 2026-08-06 (Phase 4) — content now lives on personaVersions,
    // reached via currentVersionId/draftVersionId. NOT dropped yet (a
    // separate, later, independently-verified migration does that — see
    // docs/11-persona-versioning.md); systemPrompt's NOT NULL was relaxed
    // since new code never writes it. Do not read or write these directly.
    systemPrompt: text('system_prompt'),
    welcomeMessage: text('welcome_message'),
    suggestions: jsonb('suggestions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    aiProvider: text('ai_provider').notNull().default('openai'),
    model: text('model'),
    /** 'fast' | 'balanced' | 'advanced' | null. Mutually exclusive with `model` —
     * when set, the concrete model id is resolved live from lib/ai/registry.ts
     * tiers on every request rather than stored here. */
    modelTier: text('model_tier'),
    temperature: real('temperature').notNull().default(0.8),
    topP: real('top_p'),
    frequencyPenalty: real('frequency_penalty').notNull().default(0),
    presencePenalty: real('presence_penalty').notNull().default(0),
    maxTokens: integer('max_tokens'),
    historyMessages: integer('history_messages').notNull().default(8),

    audienceType: audienceType('audience_type'),
    personality: jsonb('personality').$type<PersonaPersonality>().notNull().default(sql`'{}'::jsonb`),
    knowledgeDomains: jsonb('knowledge_domains').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    capabilities: jsonb('capabilities').$type<PersonaCapabilities>().notNull().default(sql`'{}'::jsonb`),
    /** Knowledge-source keys (e.g. "curriculum", "universe") — see src/lib/knowledge. */
    groundingSources: jsonb('grounding_sources').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Guardrail codes — see src/lib/persona/guardrails.ts. Compiled into the system prompt only. */
    guardrails: jsonb('guardrails').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Audience segment codes — see src/lib/persona/audience-segments.ts. Admin/data only for now. */
    audienceSegments: jsonb('audience_segments').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    /** Optional deep cognitive blueprint — see PersonaBlueprint. Compiled ahead of systemPrompt when set. */
    blueprint: jsonb('blueprint').$type<PersonaBlueprint>(),
    interactionStyle: interactionStyle('interaction_style'),
    approachToUnknown: approachToUnknown('approach_to_unknown'),
    promptTechnique: promptTechnique('prompt_technique').notNull().default('direct'),
    thinkingMode: boolean('thinking_mode').notNull().default(false),

    creditsPerMessage: integer('credits_per_message').notNull().default(0),
    isPremium: boolean('is_premium').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),

    chatsCount: integer('chats_count').notNull().default(0),
    messagesCount: integer('messages_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('personas_slug_idx').on(t.slug),
    index('personas_listing_idx').on(t.isActive, t.isFeatured, t.position),
    index('personas_audience_idx').on(t.audienceType),
  ],
);

/* =========================== Persona versions =============================
 * All the prompt/model/parameter *content* that used to live directly on
 * `personas` — split out 2026-08-06 (Phase 4) so a published version can be
 * immutable (`isImmutable`), which is what "can't sell or audit a bot that
 * changes under the customer" actually requires. `personas` keeps identity
 * (name/slug/avatar/…) and points at one of these via `currentVersionId`.
 *
 * Two very different lifecycles depending on `personas.pinVersioning`:
 *  - false (default, every pre-2026-08-06 persona): editing mutates the
 *    current version's row in place — identical behavior to before this
 *    table existed, just stored one join away. `isImmutable` is never set.
 *  - true: editing writes to a `draft` version (`personas.draftVersionId`),
 *    and `publishPersonaVersionAction` (src/server/actions/admin.ts) snapshots
 *    it into a new `isImmutable` row and flips `currentVersionId`.
 * See docs/11-persona-versioning.md.
 * ------------------------------------------------------------------------- */

export const personaVersions = pgTable(
  'persona_versions',
  {
    id: serial('id').primaryKey(),
    personaId: integer('persona_id').notNull().references(() => personas.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    changelog: text('changelog'),
    status: personaVersionStatus('status').notNull().default('published'),
    isImmutable: boolean('is_immutable').notNull().default(false),

    systemPrompt: text('system_prompt').notNull(),
    welcomeMessage: text('welcome_message'),
    suggestions: jsonb('suggestions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    aiProvider: text('ai_provider').notNull().default('openai'),
    model: text('model'),
    modelTier: text('model_tier'),
    temperature: real('temperature').notNull().default(0.8),
    topP: real('top_p'),
    frequencyPenalty: real('frequency_penalty').notNull().default(0),
    presencePenalty: real('presence_penalty').notNull().default(0),
    maxTokens: integer('max_tokens'),
    historyMessages: integer('history_messages').notNull().default(8),

    audienceType: audienceType('audience_type'),
    personality: jsonb('personality').$type<PersonaPersonality>().notNull().default(sql`'{}'::jsonb`),
    knowledgeDomains: jsonb('knowledge_domains').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    capabilities: jsonb('capabilities').$type<PersonaCapabilities>().notNull().default(sql`'{}'::jsonb`),
    groundingSources: jsonb('grounding_sources').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    guardrails: jsonb('guardrails').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    audienceSegments: jsonb('audience_segments').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    blueprint: jsonb('blueprint').$type<PersonaBlueprint>(),
    interactionStyle: interactionStyle('interaction_style'),
    approachToUnknown: approachToUnknown('approach_to_unknown'),
    promptTechnique: promptTechnique('prompt_technique').notNull().default('direct'),
    thinkingMode: boolean('thinking_mode').notNull().default(false),
    /**
     * Which chat UI this persona is presented through (docs/23-chat-layouts.md).
     * Plain text, not an enum — same reasoning as `modelTier`: the layout set
     * is expected to grow, and that shouldn't cost a migration.
     *
     * Null means "use `suggestLayoutForPersona()`'s computed default", so
     * every existing persona keeps working with a sensible layout and the
     * migration needs no backfill. Setting it explicitly overrides the
     * suggestion — the admin form shows which one is being suggested.
     */
    chatLayout: text('chat_layout'),

    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Null for every version created before Phase 9 (marketplace) — meaning
     * "authored by whichever team currently owns the parent persona," the
     * assumption that held for every persona in this app until installed
     * (not authored) personas existed. Set only on a version cloned via
     * `listing_installs` (src/lib/marketplace/install.ts), to the vendor's
     * team — the one field that makes docs/15-data-portability.md's
     * redaction rule (`persona_versions.system_prompt` nulled on export
     * when the authoring team isn't the exporting team) actually reachable.
     * See docs/16-marketplace.md.
     */
    authoredByTeamId: text('authored_by_team_id').references(() => teams.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('persona_versions_persona_version_idx').on(t.personaId, t.version),
    index('persona_versions_persona_idx').on(t.personaId),
  ],
);

export const personaCategories = pgTable(
  'persona_categories',
  {
    personaId: integer('persona_id').notNull().references(() => personas.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.personaId, t.categoryId] })],
);

export const promptModifiers = pgTable(
  'prompt_modifiers',
  {
    id: serial('id').primaryKey(),
    type: modifierType('type').notNull(),
    name: text('name').notNull(),
    value: text('value').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('modifiers_type_name_idx').on(t.type, t.name)],
);

/* ================================ Chat =================================== */

export const chats = pgTable(
  'chats',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Guest chats (no userId) fall back to the platform team.
    teamId: text('team_id').notNull().references(() => teams.id),
    personaId: integer('persona_id').references(() => personas.id, { onDelete: 'set null' }),
    /** Set at chat-creation time only when the persona has pinVersioning=true — see docs/11-persona-versioning.md. */
    personaVersionId: integer('persona_version_id').references(() => personaVersions.id, { onDelete: 'set null' }),
    guestToken: text('guest_token'),

    title: text('title'),
    model: text('model'),
    aiProvider: text('ai_provider'),
    modifierIds: jsonb('modifier_ids').$type<number[]>().notNull().default(sql`'[]'::jsonb`),
    /**
     * Per-conversation overrides of the persona's own cognitive settings
     * (docs/24-chat-controls.md). NULL means "use whatever the persona was
     * authored with" — so an untouched chat behaves exactly as before these
     * columns existed, and a reader can tell "never chosen" apart from
     * "deliberately set to the same value the persona already had".
     */
    interactionStyle: interactionStyle('interaction_style'),
    approachToUnknown: approachToUnknown('approach_to_unknown'),

    messagesCount: integer('messages_count').notNull().default(0),
    creditsSpent: integer('credits_spent').notNull().default(0),
    tokensUsed: integer('tokens_used').notNull().default(0),

    isShared: boolean('is_shared').notNull().default(false),
    shareToken: text('share_token'),

    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chats_user_idx').on(t.userId, t.lastMessageAt),
    index('chats_guest_idx').on(t.guestToken),
    uniqueIndex('chats_share_idx').on(t.shareToken),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
    role: messageRole('role').notNull(),
    content: text('content').notNull().default(''),

    model: text('model'),
    aiProvider: text('ai_provider'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    creditsCost: integer('credits_cost').notNull().default(0),
    latencyMs: integer('latency_ms'),

    status: messageStatus('status').notNull().default('complete'),
    error: text('error'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_chat_idx').on(t.chatId, t.position)],
);

/* =============================== Billing ================================= */

export const creditPacks = pgTable(
  'credit_packs',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    features: jsonb('features').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    // Money is always an integer in minor units. Never a float.
    priceCents: integer('price_cents').notNull(),
    compareAtCents: integer('compare_at_cents'),
    currency: text('currency').notNull().default('USD'),

    credits: integer('credits').notNull(),
    bonusCredits: integer('bonus_credits').notNull().default(0),

    badge: text('badge'),
    tier: integer('tier').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('packs_slug_idx').on(t.slug)],
);

/**
 * Recurring subscription plans — monthly/weekly/yearly/any interval. Added
 * 2026-08-06 (Phase 5) — freelee was pay-as-you-go only before this.
 * `intervalUnit`/`intervalCount` map 1:1 onto Stripe's own recurring-price
 * shape (`interval`/`interval_count`), created inline via `price_data` at
 * checkout time — no pre-created Stripe Price object needed, same pattern
 * `StripeGateway.createCheckout` already uses for one-off packs.
 */
export const plans = pgTable(
  'plans',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    intervalUnit: planInterval('interval_unit').notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull().default('GBP'),
    creditsPerCycle: integer('credits_per_cycle').notNull().default(0),
    /** Ordering for gating (`personas.minPlanTier`) — higher = more access, not just display sort. */
    tier: integer('tier').notNull().default(1),
    /** Set if a real Stripe Price was created out-of-band; unused by checkout today (inline price_data instead). */
    stripePriceId: text('stripe_price_id'),
    isActive: boolean('is_active').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plans_key_idx').on(t.key)],
);

/**
 * Time-boxed access passes — "1 hour," "1 day," "1 week" of unmetered chat
 * access, bought like a credit pack but granting an `entitlements` row
 * instead of (or alongside) credits. See docs/12-billing-overhaul.md.
 */
export const passProducts = pgTable(
  'pass_products',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    durationUnit: passDurationUnit('duration_unit').notNull(),
    durationValue: integer('duration_value').notNull().default(1),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull().default('GBP'),
    isActive: boolean('is_active').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('pass_products_key_idx').on(t.key)],
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    reference: text('reference').notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id),

    // Exactly one of these three is set, matching `kind`. Modelled as three
    // nullable FKs rather than a generic productId+productType pair so each
    // stays a real, checkable foreign key — see docs/12-billing-overhaul.md.
    kind: orderKind('kind').notNull().default('credit_pack'),
    packId: integer('pack_id').references(() => creditPacks.id, { onDelete: 'set null' }),
    planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    passProductId: integer('pass_product_id').references(() => passProducts.id, { onDelete: 'set null' }),

    // Snapshot of the product as priced at purchase time.
    packName: text('pack_name').notNull(),
    credits: integer('credits').notNull().default(0),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),

    gateway: text('gateway').notNull(),
    gatewayRef: text('gateway_ref'),
    status: orderStatus('status').notNull().default('pending'),
    creditsGranted: boolean('credits_granted').notNull().default(false),

    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_reference_idx').on(t.reference),
    index('orders_user_idx').on(t.userId, t.status),
    index('orders_gateway_ref_idx').on(t.gatewayRef),
  ],
);

/** One team's subscription state. See docs/12-billing-overhaul.md. */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').notNull().references(() => plans.id),
    status: subscriptionStatus('status').notNull().default('incomplete'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    gateway: text('gateway').notNull().default('stripe'),
    gatewayCustomerId: text('gateway_customer_id'),
    gatewaySubscriptionId: text('gateway_subscription_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_team_idx').on(t.teamId, t.status),
    uniqueIndex('subscriptions_gateway_sub_idx').on(t.gatewaySubscriptionId),
  ],
);

/**
 * Deprecated 2026-08-06 (Phase 5) — superseded by `creditWallets` +
 * `creditTransactions` below (team-scoped, not user-scoped; a subscription's
 * or pass's grant needs a wallet the whole team draws from). Not dropped —
 * pre-Phase-5 history stays queryable and was migrated forward into
 * `creditTransactions` by the backfill, not deleted. No code writes new rows
 * here going forward.
 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id),
    type: ledgerType('type').notNull(),
    amount: integer('amount').notNull(), // signed: + credit, − debit
    balanceAfter: integer('balance_after').notNull(),
    description: text('description'),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    messageId: text('message_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ledger_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Team-scoped wallet — the real spendable balance since Phase 5. One per
 * team (including personal teams, so behavior for today's solo users is
 * unchanged: their team has exactly one member, themself).
 * `users.credits`/`lifetimePurchased`/`lifetimeSpent` are now a frozen,
 * unwritten mirror — see docs/12-billing-overhaul.md.
 */
export const creditWallets = pgTable(
  'credit_wallets',
  {
    id: serial('id').primaryKey(),
    ownerType: walletOwnerType('owner_type').notNull().default('team'),
    ownerId: text('owner_id').notNull(),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    reserved: bigint('reserved', { mode: 'number' }).notNull().default(0),
    lifetimeGranted: bigint('lifetime_granted', { mode: 'number' }).notNull().default(0),
    lifetimeSpent: bigint('lifetime_spent', { mode: 'number' }).notNull().default(0),
    lowBalanceThreshold: integer('low_balance_threshold'),
    autoTopupEnabled: boolean('auto_topup_enabled').notNull().default(false),
    autoTopupAmount: integer('auto_topup_amount'),
    currency: text('currency').notNull().default('GBP'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('credit_wallets_owner_idx').on(t.ownerType, t.ownerId)],
);

/**
 * Append-only, wallet-keyed — replaces `creditLedger` as the source of
 * truth. `idempotencyKey` is new: `fulfilOrder()` keeps its own row-locked
 * `orders.creditsGranted` guard (proven, unchanged), but every other writer
 * (chat spend, subscription renewals, pass grants) uses this instead.
 */
export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    walletId: integer('wallet_id').notNull().references(() => creditWallets.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: creditTransactionType('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(), // signed: + credit, − debit
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key'),
    description: text('description'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_transactions_wallet_idx').on(t.walletId, t.createdAt),
    index('credit_transactions_team_idx').on(t.teamId, t.createdAt),
    uniqueIndex('credit_transactions_idempotency_idx').on(t.idempotencyKey),
  ],
);

/**
 * Durable or time-boxed access grants — separate from credits on purpose
 * (concept doc's own "credits ≠ entitlements" rule): a pass or subscription
 * grants *access*, not a spendable balance. `expiresAt = null` means
 * permanent (e.g. a one-off persona purchase, Phase 9). The chat route
 * checks for an active `targetType: 'platform'` entitlement before charging
 * credits — see docs/12-billing-overhaul.md.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sourceType: entitlementSourceType('source_type').notNull(),
    /** Loosely typed on purpose — spans subscriptions.id / passProducts.id / orders.id depending on sourceType. */
    sourceId: text('source_id'),
    targetType: entitlementTargetType('target_type').notNull(),
    targetId: text('target_id'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('entitlements_team_target_idx').on(t.teamId, t.targetType, t.expiresAt)],
);

/**
 * Raw per-call usage facts — never rewritten even if pricing/markup changes
 * later (concept doc's "usage_events separate from billing" rule). Populated
 * alongside `messages`/`creditTransactions` in `onFinish`, not instead of
 * them. `usageDaily` below is a parked aggregate — no rollup job built yet,
 * see docs/12-billing-overhaul.md.
 */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    teamId: text('team_id').notNull().references(() => teams.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    personaId: integer('persona_id').references(() => personas.id, { onDelete: 'set null' }),
    personaVersionId: integer('persona_version_id').references(() => personaVersions.id, { onDelete: 'set null' }),
    chatId: text('chat_id').references(() => chats.id, { onDelete: 'set null' }),
    messageId: text('message_id'),
    aiProviderKey: text('ai_provider_key').notNull(),
    aiModelId: integer('ai_model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    operation: text('operation').notNull().default('chat'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: real('cost_usd'),
    creditsCharged: bigint('credits_charged', { mode: 'number' }).notNull().default(0),
    /** True when a pass/subscription entitlement covered this turn — creditsCharged is 0, not a discount. */
    coveredByPass: boolean('covered_by_pass').notNull().default(false),
    isByok: boolean('is_byok').notNull().default(false),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('usage_events_team_idx').on(t.teamId, t.createdAt),
    index('usage_events_model_idx').on(t.aiModelId),
  ],
);

/** Parked — no rollup job writes this yet. Schema-ready for when reporting needs it. */
export const usageDaily = pgTable(
  'usage_daily',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    teamId: text('team_id').notNull().references(() => teams.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    aiModelId: integer('ai_model_id').references(() => aiModels.id, { onDelete: 'set null' }),
    tokensIn: bigint('tokens_in', { mode: 'number' }).notNull().default(0),
    tokensOut: bigint('tokens_out', { mode: 'number' }).notNull().default(0),
    requests: integer('requests').notNull().default(0),
    costUsd: real('cost_usd').notNull().default(0),
    credits: bigint('credits', { mode: 'number' }).notNull().default(0),
  },
  (t) => [uniqueIndex('usage_daily_unique_idx').on(t.date, t.teamId, t.userId, t.aiModelId)],
);

/* =============================== Marketplace ===============================
 * Phase 9 (optional, last, per the plan) — external vendors selling/sharing
 * personas to other teams. freelee's existing public /personas catalog is
 * already the concept doc's "Stage A single-creator catalog"; this is
 * Stage B/C (external vendors) only. A vendor is a team (not a separate
 * user concept), same reasoning as everything else in this app treating
 * teams as the tenant boundary. See docs/16-marketplace.md.
 * ------------------------------------------------------------------------- */
export const listingPricingModel = pgEnum('listing_pricing_model', ['free', 'one_off', 'subscription', 'credit_markup']);
export const listingStatus = pgEnum('listing_status', ['draft', 'pending_review', 'approved', 'rejected', 'suspended']);
export const payoutStatus = pgEnum('payout_status', ['pending', 'processing', 'paid', 'failed']);

export const vendors = pgTable(
  'vendors',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    slug: text('slug').notNull(),
    bio: text('bio'),
    payoutEmail: text('payout_email'),
    /**
     * Schema-ready, not wired to any Stripe API call — see docs/16-marketplace.md
     * on why real Stripe Connect onboarding and real payout transfers are
     * deliberately out of scope this phase, not just unfinished.
     */
    stripeConnectAccountId: text('stripe_connect_account_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('vendors_team_idx').on(t.teamId), uniqueIndex('vendors_slug_idx').on(t.slug)],
);

export const listings = pgTable(
  'listings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
    personaId: integer('persona_id').notNull().references(() => personas.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    pricingModel: listingPricingModel('pricing_model').notNull().default('free'),
    /** one_off/subscription only — schema-ready, checkout not built this phase (see docs/16-marketplace.md). */
    priceCents: integer('price_cents'),
    currency: text('currency').notNull().default('USD'),
    /** credit_markup only — the vendor's cut of every credit the installed persona earns; see src/lib/marketplace/payouts.ts. */
    creditMarkupPct: real('credit_markup_pct'),
    status: listingStatus('status').notNull().default('draft'),
    moderatorNote: text('moderator_note'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    installCount: integer('install_count').notNull().default(0),
    ratingAvg: real('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('listings_vendor_persona_idx').on(t.vendorId, t.personaId),
    index('listings_status_idx').on(t.status),
  ],
);

export const listingInstalls = pgTable(
  'listing_installs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    installingTeamId: text('installing_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    /** The clone created in the installing team's own catalog — src/lib/marketplace/install.ts. */
    installedPersonaId: integer('installed_persona_id').notNull().references(() => personas.id, { onDelete: 'cascade' }),
    entitlementId: integer('entitlement_id').references(() => entitlements.id, { onDelete: 'set null' }),
    /** Snapshot at install time, not a live read of listings.creditMarkupPct — payouts stay stable even if the vendor changes the rate later. */
    creditMarkupPctSnapshot: real('credit_markup_pct_snapshot'),
    installedBy: text('installed_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('listing_installs_unique_idx').on(t.listingId, t.installingTeamId)],
);

export const listingReviews = pgTable(
  'listing_reviews',
  {
    id: serial('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    installingTeamId: text('installing_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('listing_reviews_unique_idx').on(t.listingId, t.installingTeamId)],
);

/**
 * A computed record of what's owed, not a real money movement — no
 * `stripeTransferId` is ever populated by app code this phase. See
 * src/lib/marketplace/payouts.ts and docs/16-marketplace.md for why
 * actually executing a transfer is left a manual, explicitly-authorized
 * step rather than something this integration automates.
 */
export const payouts = pgTable(
  'payouts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    grossCreditsCharged: bigint('gross_credits_charged', { mode: 'number' }).notNull().default(0),
    netAmountCents: integer('net_amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    status: payoutStatus('status').notNull().default('pending'),
    stripeTransferId: text('stripe_transfer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => [index('payouts_vendor_idx').on(t.vendorId, t.periodStart)],
);

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  team: one(teams, { fields: [vendors.teamId], references: [teams.id] }),
  listings: many(listings),
  payouts: many(payouts),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  vendor: one(vendors, { fields: [listings.vendorId], references: [vendors.id] }),
  persona: one(personas, { fields: [listings.personaId], references: [personas.id] }),
  installs: many(listingInstalls),
  reviews: many(listingReviews),
}));

export const listingInstallsRelations = relations(listingInstalls, ({ one }) => ({
  listing: one(listings, { fields: [listingInstalls.listingId], references: [listings.id] }),
  installingTeam: one(teams, { fields: [listingInstalls.installingTeamId], references: [teams.id] }),
  installedPersona: one(personas, { fields: [listingInstalls.installedPersonaId], references: [personas.id] }),
}));

export const listingReviewsRelations = relations(listingReviews, ({ one }) => ({
  listing: one(listings, { fields: [listingReviews.listingId], references: [listings.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  vendor: one(vendors, { fields: [payouts.vendorId], references: [vendors.id] }),
}));

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingInstall = typeof listingInstalls.$inferSelect;
export type ListingReview = typeof listingReviews.$inferSelect;
export type Payout = typeof payouts.$inferSelect;

/* ================================= CMS =================================== */

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    excerpt: text('excerpt'),
    content: text('content').notNull().default(''),
    coverImage: text('cover_image'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    isPublished: boolean('is_published').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    views: integer('views').notNull().default(0),
    readingMinutes: integer('reading_minutes').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('posts_slug_idx').on(t.slug),
    index('posts_published_idx').on(t.isPublished, t.publishedAt),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (t) => [uniqueIndex('tags_slug_idx').on(t.slug)],
);

export const postTags = pgTable(
  'post_tags',
  {
    postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const pages = pgTable(
  'pages',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content').notNull().default(''),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    isPublished: boolean('is_published').notNull().default(true),
    isLocked: boolean('is_locked').notNull().default(false),
    noindex: boolean('noindex').notNull().default(false),
    position: integer('position').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('pages_slug_idx').on(t.slug)],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: serial('id').primaryKey(),
    location: menuLocation('location').notNull().default('header'),
    label: text('label').notNull(),
    href: text('href').notNull(),
    visibleTo: menuVisibility('visible_to').notNull().default('all'),
    openInNewTab: boolean('open_in_new_tab').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isLocked: boolean('is_locked').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('menu_location_idx').on(t.location, t.position)],
);

export const seoSettings = pgTable(
  'seo_settings',
  {
    id: serial('id').primaryKey(),
    route: text('route').notNull(),
    title: text('title'),
    description: text('description'),
    ogImage: text('og_image'),
    noindex: boolean('noindex').notNull().default(false),
  },
  (t) => [uniqueIndex('seo_route_idx').on(t.route)],
);

/* ============================ Configuration ============================== */

export const settings = pgTable(
  'settings',
  {
    key: text('key').primaryKey(),
    group: text('group').notNull().default('general'),
    value: text('value'),
    type: settingType('type').notNull().default('string'),
    label: text('label'),
    isPublic: boolean('is_public').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('settings_group_idx').on(t.group, t.position)],
);

export const themes = pgTable(
  'themes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    tokens: jsonb('tokens').$type<ThemeTokens>().notNull().default(sql`'{}'::jsonb`),
    customCss: text('custom_css'),
    // Branding, added 2026-08-07 (docs/20-branding.md) — URLs, not uploads,
    // same convention personas.avatar already uses for "an admin-supplied
    // image" in this app. logoUrl null means: fall back to the built-in
    // inline-SVG mark (src/components/site/logo.tsx), never a broken image.
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    // A curated key (e.g. 'inter', 'system', 'georgia'), not an arbitrary
    // font string — resolved to a real font-family stack in
    // src/lib/branding/fonts.ts, the same "fixed small set, not a full
    // integration" trade-off as src/lib/knowledge/registry.ts's dot-paths.
    headingFont: text('heading_font'),
    bodyFont: text('body_font'),
  },
  (t) => [uniqueIndex('themes_slug_idx').on(t.slug)],
);

/**
 * The home page as an ordered list of togglable/reorderable sections
 * instead of fixed JSX — `page` is a plain text column (default `'home'`)
 * so a second page could reuse this later, not architecturally locked to
 * one. Six of the seven original sections (`hero`, `categories`,
 * `featured_personas`, `how_it_works`, `pricing`, `cta` — `blog` too, seven
 * total) are "core": seeded exactly once by the migration, never created or
 * deleted through the UI (`deleteSectionAction` refuses anything but
 * `custom_content` — enforced in the action, not just hidden in the UI, see
 * docs/19-frontpage-sections.md). `custom_content` is the one genuinely
 * repeatable type — add as many as wanted, no code change. No DB unique
 * constraint on `(page, type)`: it would have to exclude `custom_content`
 * anyway, and there's no UI path that could create a second core section,
 * so application-level enforcement (the seed migration + the delete guard)
 * is sufficient rather than fighting a partial-unique-index around it.
 */
export const pageSections = pgTable(
  'page_sections',
  {
    id: serial('id').primaryKey(),
    page: text('page').notNull().default('home'),
    type: text('type').notNull(),
    position: integer('position').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('page_sections_page_idx').on(t.page, t.position)],
);

export type PageSectionRow = typeof pageSections.$inferSelect;
export type NewPageSectionRow = typeof pageSections.$inferInsert;

export const activityLog = pgTable(
  'activity_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    // Nullable — pre-teams rows and platform-wide admin actions (e.g. editing
    // the model registry, Phase 3) legitimately have no single owning team.
    teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    description: text('description'),
    // Reused for team-scoped audit events (member invited/removed, role
    // changed, module toggled) rather than introducing a parallel
    // audit_logs table — see docs/09-team-authorization.md.
    targetType: text('target_type'),
    targetId: text('target_id'),
    oldValues: jsonb('old_values').$type<Record<string, unknown>>(),
    newValues: jsonb('new_values').$type<Record<string, unknown>>(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('activity_action_idx').on(t.action, t.createdAt),
    index('activity_team_idx').on(t.teamId, t.createdAt),
  ],
);

/* ============================== Relations ================================ */

export const usersRelations = relations(users, ({ one, many }) => ({
  chats: many(chats),
  orders: many(orders),
  ledger: many(creditLedger),
  posts: many(posts),
  defaultTeam: one(teams, { fields: [users.defaultTeamId], references: [teams.id] }),
  teamMemberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
  personas: many(personas),
  chats: many(chats),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, { fields: [teamInvitations.teamId], references: [teams.id] }),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  teams: many(moduleTeam),
}));

export const moduleTeamRelations = relations(moduleTeam, ({ one }) => ({
  module: one(modules, { fields: [moduleTeam.moduleId], references: [modules.id] }),
  team: one(teams, { fields: [moduleTeam.teamId], references: [teams.id] }),
}));

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  models: many(aiModels),
  credentials: many(providerCredentials),
}));

export const aiModelsRelations = relations(aiModels, ({ one, many }) => ({
  provider: one(aiProviders, { fields: [aiModels.providerId], references: [aiProviders.id] }),
  teams: many(aiModelTeam),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  categories: many(personaCategories),
  chats: many(chats),
  team: one(teams, { fields: [personas.teamId], references: [teams.id] }),
  currentVersion: one(personaVersions, { fields: [personas.currentVersionId], references: [personaVersions.id] }),
  versions: many(personaVersions),
}));

export const personaVersionsRelations = relations(personaVersions, ({ one }) => ({
  persona: one(personas, { fields: [personaVersions.personaId], references: [personas.id] }),
  createdByUser: one(users, { fields: [personaVersions.createdBy], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  personas: many(personaCategories),
  posts: many(posts),
  sectors: many(sectors),
}));

export const sectorsRelations = relations(sectors, ({ one }) => ({
  category: one(categories, { fields: [sectors.categoryId], references: [categories.id] }),
}));

export const personaCategoriesRelations = relations(personaCategories, ({ one }) => ({
  persona: one(personas, { fields: [personaCategories.personaId], references: [personas.id] }),
  category: one(categories, { fields: [personaCategories.categoryId], references: [categories.id] }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, { fields: [chats.userId], references: [users.id] }),
  persona: one(personas, { fields: [chats.personaId], references: [personas.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  pack: one(creditPacks, { fields: [orders.packId], references: [creditPacks.id] }),
  plan: one(plans, { fields: [orders.planId], references: [plans.id] }),
  passProduct: one(passProducts, { fields: [orders.passProductId], references: [passProducts.id] }),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  user: one(users, { fields: [creditLedger.userId], references: [users.id] }),
  order: one(orders, { fields: [creditLedger.orderId], references: [orders.id] }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  team: one(teams, { fields: [subscriptions.teamId], references: [teams.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const creditWalletsRelations = relations(creditWallets, ({ many }) => ({
  transactions: many(creditTransactions),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  wallet: one(creditWallets, { fields: [creditTransactions.walletId], references: [creditWallets.id] }),
  team: one(teams, { fields: [creditTransactions.teamId], references: [teams.id] }),
  user: one(users, { fields: [creditTransactions.userId], references: [users.id] }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  team: one(teams, { fields: [entitlements.teamId], references: [teams.id] }),
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  team: one(teams, { fields: [usageEvents.teamId], references: [teams.id] }),
  persona: one(personas, { fields: [usageEvents.personaId], references: [personas.id] }),
  aiModel: one(aiModels, { fields: [usageEvents.aiModelId], references: [aiModels.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  tags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({ posts: many(postTags) }));

/* ============================ Inferred types ============================= */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type ModuleRow = typeof modules.$inferSelect;
export type ModuleTeamRow = typeof moduleTeam.$inferSelect;
export type AiProviderRow = typeof aiProviders.$inferSelect;
export type AiModelRow = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type PersonaVersion = typeof personaVersions.$inferSelect;
export type NewPersonaVersion = typeof personaVersions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Sector = typeof sectors.$inferSelect;
export type NewSector = typeof sectors.$inferInsert;
export type PromptModifier = typeof promptModifiers.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CreditPack = typeof creditPacks.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type LedgerEntry = typeof creditLedger.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PassProduct = typeof passProducts.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CreditWallet = typeof creditWallets.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type Entitlement = typeof entitlements.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Theme = typeof themes.$inferSelect;

/* =============================== Translations ==============================
 * Platform-wide (not team-scoped, unlike almost everything else built this
 * session) — the whole point is one admin-controlled site language, not a
 * per-team preference. `namespace` splits the frontend/landing surface from
 * the admin panel so they can be switched independently (frontend_locale/
 * admin_locale settings, src/lib/i18n/translate.ts). Plain text, not an
 * enum, for both `namespace` and `locale` — same reasoning as
 * `personas.modelTier`: closed vocabularies that are still just app config,
 * not worth a migration to extend. English is never stored here — it's
 * always the literal fallback string already at each `t(key, fallback)`
 * call site, so there's nothing to keep in sync and no row to go stale.
 * See docs/17-translations.md.
 * ------------------------------------------------------------------------- */
export const translations = pgTable(
  'translations',
  {
    id: serial('id').primaryKey(),
    namespace: text('namespace').notNull(),
    key: text('key').notNull(),
    locale: text('locale').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('translations_unique_idx').on(t.namespace, t.key, t.locale)],
);

export type TranslationRow = typeof translations.$inferSelect;
export type NewTranslationRow = typeof translations.$inferInsert;

/**
 * The DB-backed locale registry — what used to be a hardcoded
 * `SUPPORTED_LOCALES` TS array is now real data, specifically so
 * `/admin/translations` (docs/17-translations.md) can add a language at
 * runtime without a code change. `status`: `pending` = being generated by
 * the AI translation pipeline right now, not selectable as `frontend_locale`/
 * `admin_locale` yet ("frozen" in the admin UI's own words) — `active` =
 * translated and selectable. `en` is seeded `active` and is never itself
 * translated (see the `translations` comment above) — it's the permanent
 * baseline every other locale's admin add-flow starts from.
 */
export const localeStatus = pgEnum('locale_status', ['pending', 'active']);

export const locales = pgTable('locales', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  status: localeStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LocaleRow = typeof locales.$inferSelect;

/**
 * The video half of the "?" help tips (docs/22-help-tips.md). The *text* of
 * each tip lives in code as `t('help.…')` call sites (src/lib/help/topics.ts)
 * so the translation pipeline can see and translate it; only the video URL —
 * which is admin-supplied data, not UI copy — is stored here.
 *
 * Every topic works with no row at all: `videoUrl` null (or the row missing
 * entirely) renders the tip as text only, which is the state of all of them
 * today. The instructional-video feature itself is deliberately not built
 * yet — this is the schema and the render slot it will land in, nothing more.
 */
export const helpTopics = pgTable(
  'help_topics',
  {
    id: serial('id').primaryKey(),
    /** Matches a key in HELP_TOPIC_KEYS (src/lib/help/topics.ts), e.g. 'pricing.credits'. */
    key: text('key').notNull(),
    videoUrl: text('video_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('help_topics_key_idx').on(t.key)],
);

export type HelpTopicRow = typeof helpTopics.$inferSelect;

/* ========================== Data portability (Phase 8) ====================
 * Core, always-on capability (src/lib/portability/**, docs/15-data-portability.md)
 * — not a src/modules/<key> feature module, same reasoning as the AI model
 * registry: export/import is platform infrastructure, not an optional
 * product surface. externalIdMap is the whole idempotency mechanism for
 * import: a bundle's original row id -> the locally-inserted row id, keyed
 * per team+entity, so re-importing the same bundle is a no-op the second
 * time instead of duplicating rows.
 * ------------------------------------------------------------------------- */
export const externalIdMap = pgTable(
  'external_id_map',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    externalId: text('external_id').notNull(),
    localId: text('local_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('external_id_map_unique_idx').on(t.teamId, t.entityType, t.externalId)],
);

export type ExternalIdMapRow = typeof externalIdMap.$inferSelect;

/* ============================= Feature modules =============================
 * Core tables live directly above; a `type: 'feature'` module's own tables
 * live under src/modules/<key>/schema.ts and are re-exported here — the
 * convention set out in docs/08-module-architecture.md. Drizzle's relational
 * query API needs one merged schema object, so this barrel is required, not
 * just tidy; the migrations these tables need still land in the single
 * top-level drizzle/000N sequence (no per-module migration directories).
 * ------------------------------------------------------------------------- */
export * from '@/modules/group-chat/schema';
export * from '@/modules/crews/schema';
