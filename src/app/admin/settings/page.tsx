import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { aiProviders, aiModels } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { SettingsNav } from '@/components/admin/settings-nav';
import { SettingsForm } from '@/components/admin/settings-form';
import { AiDefaultsForm } from '@/components/admin/ai-settings-form';
import { ModelsManager, type ProviderBundle } from '@/components/admin/models-manager';
import { ConnectionCard } from '@/components/admin/connection-card';
import { EmbeddingModelPicker } from '@/components/admin/embedding-model-picker';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import { DEFAULT_SECTION, settingsSection, type SettingsSection } from '@/lib/admin/settings-sections';
import { getSettings, getSettingString, type SettingValue } from '@/lib/settings';
import { CHAT_PROVIDER_IDS, findEmbeddingModel, getProviderRegistry } from '@/lib/ai/registry';
import { connectionView, type ConnectionId } from '@/lib/connections/registry';
import {
  chooseConnectionItemAction,
  fetchConnectionAction,
  saveConnectionAction,
  testConnectionAction,
} from '@/server/actions/admin-connections';

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
  const active = settingsSection(sectionParam ?? group ?? DEFAULT_SECTION) ?? settingsSection(DEFAULT_SECTION)!;

  const settings = await getSettings();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Everything that configures the platform, grouped by what it affects. Changes take effect immediately."
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

const AI_PROVIDER_CONNECTIONS: ConnectionId[] = ['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'stability'];

/**
 * What each section shows. Connection cards come first wherever a section has
 * an outside service behind it, because "is it connected?" is the question to
 * answer before any of the settings under it can matter.
 */
async function SectionBody({ section, settings }: { section: SettingsSection; settings: Settings }) {
  switch (section.id) {
    case 'models':
      return <ModelsSection />;

    case 'ai':
      return (
        <div className="space-y-10">
          <Block heading="AI providers" blurb="Save a key, press Test, then Fetch models to bring in what the provider offers.">
            <Connections ids={AI_PROVIDER_CONNECTIONS} settings={settings} />
          </Block>
          <Block heading="Tools" blurb="Services bots call on while they answer.">
            <Connections ids={['tavily', 'elevenlabs']} settings={settings} />
          </Block>
          <Block
            heading="Knowledge"
            blurb="Outside libraries bots look things up in. The curriculum is what tutor bots teach from."
          >
            <Connections ids={['curriculum']} settings={settings} />
          </Block>
          <Block heading="Defaults" blurb="What bots fall back to, what visitors get for free, and how input is checked.">
            <SchemaSection sectionId="ai" settings={settings} />
          </Block>
        </div>
      );

    case 'email':
      return (
        <div className="space-y-6">
          <Connections ids={['resend']} settings={settings} />
          <SchemaSection sectionId="email" settings={settings} omit={['resend_api_key']} />
        </div>
      );

    case 'billing':
      return (
        <div className="space-y-6">
          <Connections ids={['stripe', 'paypal']} settings={settings} />
          <SchemaSection sectionId="billing" settings={settings} />
        </div>
      );

    case 'storage':
      return <Connections ids={['s3']} settings={settings} />;

    default:
      return <SchemaSection sectionId={section.id} settings={settings} />;
  }
}

function Block({ heading, blurb, children }: { heading: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{heading}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * One card per connection. The actions are bound to the connection id here,
 * on the server, so the card itself knows nothing about which service it is
 * talking to.
 */
function Connections({ ids, settings }: { ids: ConnectionId[]; settings: Settings }) {
  return (
    <div className="space-y-4">
      {ids.map((id) => {
        const { canFetch, canChoose, ...view } = connectionView(id, settings);
        return (
          <ConnectionCard
            key={id}
            {...view}
            save={view.envOnly ? undefined : saveConnectionAction.bind(null, id)}
            test={testConnectionAction.bind(null, id)}
            fetch={canFetch ? fetchConnectionAction.bind(null, id) : undefined}
            choose={canChoose ? chooseConnectionItemAction.bind(null, id) : undefined}
          />
        );
      })}
    </div>
  );
}

/** A plain settings group driven by SETTINGS_SCHEMA. */
async function SchemaSection({
  sectionId,
  settings,
  omit,
}: {
  sectionId: string;
  settings: Settings;
  omit?: string[];
}) {
  const section = settingsSection(sectionId);
  if (!section?.schemaGroup) notFound();

  // Secrets are never echoed back into the DOM; a blank field keeps the value.
  const values: Record<string, string | boolean> = {};
  for (const field of SETTINGS_SCHEMA[section.schemaGroup]) {
    const raw = settings.get(field.key);
    values[field.key] =
      field.type === 'secret' ? '' : field.type === 'bool' ? Boolean(raw) : String(raw ?? '');
  }

  if (section.schemaGroup === 'ai') {
    return <AiDefaultsForm values={values} providers={await getProviderRegistry()} />;
  }

  return <SettingsForm group={section.schemaGroup} values={values} omit={omit} />;
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
        <Link href="/admin/settings?section=ai" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Providers &amp; keys
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
