import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { SettingsForm } from '@/components/admin/settings-form';
import { AiSettingsForm } from '@/components/admin/ai-settings-form';
import { SETTINGS_SCHEMA, type SettingsGroup } from '@/lib/settings-schema';
import { getSettings } from '@/lib/settings';
import { getProviderRegistry } from '@/lib/ai/registry';
import { cn } from '@/lib/utils';

/**
 * Per-user content: never prerendered, never cached at the edge.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Settings' };

const GROUPS = Object.keys(SETTINGS_SCHEMA) as SettingsGroup[];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const active: SettingsGroup = GROUPS.includes(group as SettingsGroup)
    ? (group as SettingsGroup)
    : 'general';

  const settings = await getSettings();

  // Secrets are never echoed back into the DOM; a blank field keeps the value.
  const values: Record<string, string | boolean> = {};
  for (const field of SETTINGS_SCHEMA[active]) {
    const raw = settings.get(field.key);
    values[field.key] =
      field.type === 'secret' ? '' : field.type === 'bool' ? Boolean(raw) : String(raw ?? '');
  }

  return (
    <div>
      <PageHeader title="Settings" description="Runtime configuration. Changes take effect immediately." />

      <div className="grid gap-6 lg:grid-cols-4">
        <nav className="h-fit rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {GROUPS.map((item) => (
            <Link
              key={item}
              href={`/admin/settings?group=${item}`}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium capitalize transition',
                item === active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {item}
            </Link>
          ))}
        </nav>

        <div className="lg:col-span-3">
          {active === 'ai' ? (
            <AiSettingsForm values={values} providers={await getProviderRegistry()} />
          ) : (
            <SettingsForm group={active} values={values} />
          )}
        </div>
      </div>
    </div>
  );
}
