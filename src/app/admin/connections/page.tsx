import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { ConnectionsList } from '@/components/admin/connections-list';
import { getSettings } from '@/lib/settings';
import { connectionView } from '@/lib/connections/registry';
import { CONNECTION_GROUPS, HEALTH_LABEL, connectionHealth, type ConnectionHealth } from '@/lib/admin/connection-groups';
import { relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connections' };

const HEALTH_STYLE: Record<ConnectionHealth, string> = {
  working: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  failing: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  untested: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  off: 'border-slate-200 text-slate-500 dark:border-white/10',
};

/**
 * Every key and outside service in one place (2026-11-14), grouped by what it
 * is for, with a summary at the top: what works, what fails, what was never
 * tested, what is not set up. Settings keeps the values that are not keys.
 */
export default async function ConnectionsPage() {
  const settings = await getSettings();
  const rows = CONNECTION_GROUPS.flatMap((group) =>
    group.ids.map((id) => {
      const view = connectionView(id, settings);
      return { id, group: group.id, title: view.title, health: connectionHealth(view), at: view.lastTest?.at ?? null };
    }),
  );
  const count = (health: ConnectionHealth) => rows.filter((r) => r.health === health).length;

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Every key and outside service the platform uses: save it, press Test, and where there is something to bring in, Fetch. A key saved here overrides one in the server file."
      />

      <section className="mb-8">
        <p className="mb-3 flex flex-wrap gap-2 text-xs">
          {(['working', 'failing', 'untested', 'off'] as const).map((health) => (
            <span key={health} className={cn('rounded-full border px-2.5 py-1 font-semibold', HEALTH_STYLE[health])}>
              {count(health)} {HEALTH_LABEL[health].toLowerCase()}
            </span>
          ))}
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`#conn-${row.id}`}
                className="flex items-center gap-2 rounded-control border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-white/[0.03] dark:border-white/10"
              >
                <span className="min-w-0 flex-1 truncate">{row.title}</span>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px]', HEALTH_STYLE[row.health])} title={row.at ? `Tested ${relativeTime(row.at)}` : undefined}>
                  {HEALTH_LABEL[row.health]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-10">
        {CONNECTION_GROUPS.map((group) => (
          <section key={group.id} id={`group-${group.id}`} className="scroll-mt-24 space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{group.heading}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{group.blurb}</p>
            </div>
            <ConnectionsList ids={group.ids} settings={settings} />
          </section>
        ))}
      </div>
    </div>
  );
}
