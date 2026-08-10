import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiProviders, aiModels } from '@/db/schema';
import { PageHeader } from '@/components/admin/page-header';
import { SettingsNav } from '@/components/admin/settings-nav';
import { SettingsForm } from '@/components/admin/settings-form';
import { AiSettingsForm } from '@/components/admin/ai-settings-form';
import { ModelsManager, type ProviderBundle } from '@/components/admin/models-manager';
import { FetchModelsPanel } from '@/components/admin/fetch-models-panel';
import { SETTINGS_SCHEMA } from '@/lib/settings-schema';
import { DEFAULT_SECTION, settingsSection } from '@/lib/admin/settings-sections';
import { getSettings } from '@/lib/settings';
import { getProviderRegistry } from '@/lib/ai/registry';

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

          {active.id === 'models' ? <ModelsSection /> : <SchemaSection sectionId={active.id} settings={settings} />}
        </div>
      </div>
    </div>
  );
}

/** A plain settings group driven by SETTINGS_SCHEMA. */
async function SchemaSection({ sectionId, settings }: { sectionId: string; settings: Map<string, unknown> }) {
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
    return <AiSettingsForm values={values} providers={await getProviderRegistry()} />;
  }

  return <SettingsForm group={section.schemaGroup} values={values} />;
}

/**
 * The model catalog, now a settings section rather than its own top-level page.
 *
 * It is configuration in exactly the same sense as the API keys two sections
 * above it, and splitting the two meant setting up a provider took two screens
 * that never referred to each other.
 */
async function ModelsSection() {
  const [providers, models, registry, settings] = await Promise.all([
    db.select().from(aiProviders).orderBy(asc(aiProviders.sort)),
    db.select().from(aiModels).orderBy(asc(aiModels.sort), asc(aiModels.modelId)),
    getProviderRegistry(),
    getSettings(),
  ]);

  const bundles: ProviderBundle[] = providers.map((provider) => {
    const own = models.filter((model) => model.providerId === provider.id);
    const meta = registry[provider.key as keyof typeof registry];
    const supportsImages = Boolean(meta?.supports?.includes('images'));

    const toRow = (model: (typeof models)[number]) => ({
      id: model.id,
      modelId: model.modelId,
      label: model.label,
      tier: model.tier,
      status: model.status,
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
      chatModels: own.filter((model) => model.modality === 'text').map(toRow),
      imageModels: own.filter((model) => model.modality === 'image').map(toRow),
    };
  });

  // Rendered here rather than inside the client manager: each panel owns server
  // actions, which cannot be created inside a client component.
  const fetchPanels = Object.fromEntries(
    providers.map((provider) => [provider.key, <FetchModelsPanel key={provider.key} providerId={provider.id} />]),
  );

  return <ModelsManager bundles={bundles} fetchPanels={fetchPanels} />;
}
