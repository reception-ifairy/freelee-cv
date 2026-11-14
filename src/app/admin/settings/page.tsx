import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { aiProviders, aiModels } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { SettingsNav } from '@/components/admin/settings-nav';
import { SettingsForm } from '@/components/admin/settings-form';
import { AiDefaultsForm } from '@/components/admin/ai-settings-form';
import { ModelsManager, type ProviderBundle } from '@/components/admin/models-manager';
import { EmbeddingModelPicker } from '@/components/admin/embedding-model-picker';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import { DEFAULT_SECTION, MOVED_SECTIONS, SECTION_FIELDS, settingsSection, type SettingsSection } from '@/lib/admin/settings-sections';
import type { SettingsGroup } from '@/lib/settings-schema';
import { getSettings, getSettingString, type SettingValue } from '@/lib/settings';
import { CHAT_PROVIDER_IDS, findEmbeddingModel, getProviderRegistry } from '@/lib/ai/registry';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Settings' };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; group?: string }>;
}) {
  // `group` is the old parameter name — kept so existing links and bookmarks
  // still land somewhere sensible rather than silently on General.
  const { section: sectionParam, group } = await searchParams;
  // Sections that moved off this page (Media storage, the connection cards) — old links land where they went.
  const moved = MOVED_SECTIONS[sectionParam ?? group ?? ''];
  if (moved) redirect(moved);
  const active = settingsSection(sectionParam ?? group ?? DEFAULT_SECTION) ?? settingsSection(DEFAULT_SECTION)!;

  const settings = await getSettings();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="The values that configure the platform, grouped by what they affect. Keys and outside services are under Connections. Changes take effect immediately."
      />

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="h-fit rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SettingsNav active={active.id} />
        </div>

        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight">{active.label}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{active.description}</p>
          </div>

          <SectionBody section={active} settings={settings} />
        </div>
      </div>
    </div>
  );
}

type Settings = Map<string, SettingValue>;

/**
 * What each section shows: the values in SECTION_FIELDS, nothing else. The
 * connection cards that used to sit here (providers, tools, the curriculum,
 * Resend, Stripe, PayPal, S3) live on /admin/connections now — one home per
 * key, checked by scripts/verify-settings-map.ts.
 */
async function SectionBody({ section, settings }: { section: SettingsSection; settings: Settings }) {
  switch (section.id) {
    case 'models':
      return <ModelsSection />;

    case 'billing':
      return (
        <div className="space-y-8">
          <ConnectionsHint text="Stripe and PayPal checks are under" anchor="group-payments" />
          <SchemaSection group="billing" keys={['bank_transfer_details', 'invoice_vendor']} settings={settings} />
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Free use</h3>
            <SchemaSection group="ai" keys={['guest_free_messages', 'signup_bonus_credits']} settings={settings} />
          </div>
        </div>
      );

    case 'email':
      return (
        <div className="space-y-6">
          <ConnectionsHint text="The Resend key and its Test are under" anchor="conn-resend" />
          <SchemaSection group="email" keys={SECTION_FIELDS.email} settings={settings} />
        </div>
      );

    case 'ai':
      return (
        <div className="space-y-6">
          <ConnectionsHint text="Provider keys, Test and Fetch models are under" anchor="group-ai" />
          <SchemaSection group="ai" keys={SECTION_FIELDS.ai} settings={settings} />
        </div>
      );

    default:
      if (!section.schemaGroup) notFound();
      return <SchemaSection group={section.schemaGroup} keys={SECTION_FIELDS[section.id] ?? []} settings={settings} />;
  }
}

function ConnectionsHint({ text, anchor }: { text: string; anchor: string }) {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {text}{' '}
      <Link href={`/admin/connections#${anchor}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
        Connections
      </Link>
      .
    </p>
  );
}

/** Some keys of one SETTINGS_SCHEMA group, as a form. */
async function SchemaSection({ group, keys, settings }: { group: SettingsGroup; keys: readonly string[]; settings: Settings }) {
  // Secrets are never echoed back into the DOM; a blank field keeps the value.
  const values: Record<string, string | boolean> = {};
  for (const field of SETTINGS_SCHEMA[group]) {
    const raw = settings.get(field.key);
    values[field.key] =
      field.type === 'secret' ? '' : field.type === 'bool' ? Boolean(raw) : String(raw ?? '');
  }

  if (group === 'ai') {
    return <AiDefaultsForm values={values} providers={await getProviderRegistry()} keys={keys} />;
  }
  const omit = SETTINGS_SCHEMA[group].map((field) => field.key).filter((key) => !keys.includes(key));
  return <SettingsForm group={group} values={values} omit={omit} />;
}

/**
 * The model catalog, now a settings section rather than its own top-level page.
 *
 * It is configuration in exactly the same sense as the API keys two sections
 * above it, and splitting the two meant setting up a provider took two screens
 * that never referred to each other.
 */
async function ModelsSection() {
  const [providers, models, registry, settings, embeddingPreference] = await Promise.all([
    db.select().from(aiProviders).orderBy(asc(aiProviders.sort)),
    db.select().from(aiModels).orderBy(asc(aiModels.sort), asc(aiModels.modelId)),
    getProviderRegistry(),
    getSettings(),
    getSettingString('library_embedding_model'),
  ]);

  const bundles: ProviderBundle[] = providers.map((provider) => {
    const own = models.filter((model) => model.providerId === provider.id);
    const vetted = own.filter((model) => model.status !== 'preview');
    const meta = registry[provider.key as keyof typeof registry];
    const supportsImages = Boolean(meta?.supports?.includes('images'));

    const toRow = (model: (typeof models)[number]) => ({
      id: model.id,
      modelId: model.modelId,
      label: model.label,
      tier: model.tier,
      status: model.status,
      modality: model.modality,
      creditsPer1k: model.creditsPer1k,
      sort: model.sort,
      isDefault: model.modelId === provider.defaultModel,
    });

    return {
      provider: {
        id: provider.id,
        key: provider.key,
        label: provider.label,
        apiKeyEnv: provider.apiKeyEnv,
        defaultModel: provider.defaultModel,
        isActive: provider.isActive,
        hasKey: Boolean(settings.get(`${provider.key}_api_key`)) || Boolean(process.env[provider.apiKeyEnv]),
        supportsImages,
        isImageOnly: supportsImages && !meta?.supports?.includes('stream'),
        // Ollama runs on this box: free, private, and far too slow for
        // customer-facing work. Flagged so the card can say so.
        isLocal: provider.key === 'ollama',
      },
      // Preview rows are split out whatever their modality: they are the
      // unvetted remainder of a Fetch, and the card collapses them.
      chatModels: vetted.filter((model) => model.modality === 'text').map(toRow),
      imageModels: vetted.filter((model) => model.modality === 'image').map(toRow),
      embeddingModels: vetted.filter((model) => model.modality === 'embedding').map(toRow),
      previewModels: own.filter((model) => model.status === 'preview').map(toRow),
    };
  });

  // Exactly the candidates `findEmbeddingModel()` walks — Stable rows on chat
  // providers, in the same order — so the picker cannot offer a model the
  // embedder would skip. Deduplicated by id because that lookup is by id.
  const embeddingOptions = [
    ...new Map(
      CHAT_PROVIDER_IDS.flatMap((providerId) =>
        (registry[providerId]?.models ?? [])
          .filter((model) => model.modality === 'embedding')
          .map((model) => [model.id, { id: model.id, label: model.label, meta: registry[providerId].label }] as const),
      ),
    ).values(),
  ];
  const activeEmbedding = findEmbeddingModel(registry, embeddingPreference || null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        To check a key or bring in new models, use <strong>Test</strong> and <strong>Fetch models</strong> under{' '}
        <Link href="/admin/connections#group-ai" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Connections
        </Link>
        .
      </p>
      <EmbeddingModelPicker
        options={embeddingOptions}
        value={embeddingPreference}
        activeId={activeEmbedding?.modelId ?? null}
      />
      <ModelsManager bundles={bundles} />
    </div>
  );
}
