export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * @deprecated Use `StatTile` from `@/components/ui/stat-tile` — it takes the
 * same props plus `trend`, `spark` and `icon`. Kept as a re-export so the two
 * existing callers (the dashboard and sales) did not have to change in the
 * same commit that introduced the tile.
 */
export { StatTile as Stat } from '@/components/ui/stat-tile';
