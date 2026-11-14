import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, FlaskConical, Layers, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { ListPagination } from '@/components/admin/list-pagination';
import { ResourceView, type ResourceItem } from '@/components/admin/resource-view';
import { TabNav } from '@/components/admin/tab-nav';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { RouteSheet } from '@/components/ui/route-sheet';
import { PersonaMark } from '@/components/site/persona-mark';
import { sortToggle } from '@/lib/admin/list-query';
import {
  BROWSER_PATH, RISK_MEANING, RISK_TONE, buildTree, neighbours, openKey, parseBrowser, selectionHref, withOpen,
  type OpenRef, type Selection, type Tree,
} from '@/lib/taxonomy/browser';
import {
  browserPersonas, browserSectors, categoryHeader, personaCard, sectorCard, treeCounts, treeInputs,
  type BrowserPersonaRow, type BrowserSectorRow,
} from '@/lib/taxonomy/browser-queries';
import { botPillars, categoryPillars, categorySegments } from '@/lib/taxonomy/pillar-queries';
import { PILLARS, PILLAR_BY_ID, isPillarId, type PillarId } from '@/lib/taxonomy/pillars';
import { PersonaSheetBody, SectorSheetBody } from './browser-cards';
import { TaxonomyTree } from './taxonomy-tree';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Taxonomy' };

/**
 * The taxonomy as a browser (owner, 2026-11-14): a tree of categories and
 * sectors on the left, the personas or sectors of the selected node as a
 * table on the right, and a card in a sheet when a row is clicked.
 *
 * It replaces one long column of 20 category cards holding 103 sector tiles,
 * which had no search, no filter, and sector tiles that led to an edit form
 * rather than to the specialists filed there. State is entirely in the URL
 * (see src/lib/taxonomy/browser.ts), so every view is a link and Back works.
 */
export default async function TaxonomyBrowserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [raw, inputs, bySegments] = await Promise.all([searchParams, treeInputs(), categorySegments()]);
  // Markets are computed in code from each bot's audience (pillars.ts), so the
  // market's bots are found first and the counts and list narrowed to them.
  const bots = await botPillars(bySegments);
  const rawPillar = Array.isArray(raw.pillar) ? raw.pillar[0] : raw.pillar;
  const pillar: PillarId | null = rawPillar && isPillarId(rawPillar) ? rawPillar : null;
  const pillarBots = pillar ? bots.filter((b) => b.pillar === pillar).map((b) => b.id) : null;
  const pillarsByCategory = categoryPillars(bots, bySegments, inputs.categories.map((c) => c.id));
  const marketCategories = pillar ? inputs.categories.filter((c) => pillarsByCategory.get(c.id)?.includes(pillar)) : inputs.categories;

  const counts = await treeCounts(pillarBots);
  const tree = buildTree(marketCategories, inputs.sectors, counts);
  const { selection, config, params, open } = parseBrowser(raw, tree);

  const [list, header, card] = await Promise.all([
    selection.tab === 'sectors'
      ? browserSectors(selection, params, pillar ? marketCategories.map((c) => c.id) : null)
      : browserPersonas(selection, params, pillarBots),
    typeof selection.cat === 'number' && selection.sec === null ? categoryHeader(selection.cat) : null,
    open?.kind === 'persona' ? personaCard(open.id) : open?.kind === 'sector' ? sectorCard(open.id) : null,
  ]);

  const category = typeof selection.cat === 'number' ? tree.categories.find((c) => c.id === selection.cat) ?? null : null;
  const sector = selection.sec !== null ? category?.sectors.find((s) => s.id === selection.sec) ?? null : null;

  const items =
    selection.tab === 'sectors'
      ? (list.rows as BrowserSectorRow[]).map((row) => sectorItem(row, selection, params, config))
      : (list.rows as BrowserPersonaRow[]).map((row) => personaItem(row, selection, params, config));
  const openId = open ? openKey(open) : null;
  const closeHref = withOpen(params, config, null);

  return (
    <div>
      <PageHeader
        title="Taxonomy"
        description="Every field, its specialisms and the bots filed there. Pick a category or sector on the left; click a row for its card."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/sectors/new" className="inline-flex h-10 items-center gap-2 rounded-control border hairline px-3 text-sm font-semibold hover:bg-white/[0.03]">
              <Plus className="size-4" /> Sector
            </Link>
            <Link href="/admin/categories/new" className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-on-brand hover:bg-brand-700">
              <Plus className="size-4" /> Category
            </Link>
          </div>
        }
      />

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
        {/* Two renders of one tree: a sidebar from lg, a folded section above
            the list below it — a 272px column beside a phone-width table is
            neither a tree nor a table. */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 pb-4">
            <MarketPicker bots={bots} selection={selection} params={params} config={config} />
            <TaxonomyTree tree={tree} selection={selection} params={params} config={config} pillarsByCategory={Object.fromEntries(pillarsByCategory)} />
          </div>
        </aside>
        <div className="mb-4 rounded-card border hairline px-2 lg:hidden">
          <Disclosure
            title={`Browse: ${[pillar ? PILLAR_BY_ID[pillar].label : null, sector ? `${category?.name} › ${sector.name}` : category?.name ?? (selection.cat === 'none' ? 'No category' : pillar ? null : 'All categories')].filter(Boolean).join(' · ')}`}
          >
            <MarketPicker bots={bots} selection={selection} params={params} config={config} />
            <TaxonomyTree tree={tree} selection={selection} params={params} config={config} pillarsByCategory={Object.fromEntries(pillarsByCategory)} />
          </Disclosure>
        </div>

        <section className="min-w-0">
          <NodeHeader tree={tree} selection={selection} header={header} params={params} config={config} />

          {selection.sec === null && selection.cat !== 'none' ? (
            <TabNav
              label="What to list"
              active={selection.tab}
              className="mb-4"
              tabs={[
                { id: 'personas', label: 'Personas', href: selectionHref(params, config, selection, { tab: 'personas' }), count: (category ?? tree.all).total },
                { id: 'sectors', label: 'Sectors', href: selectionHref(params, config, selection, { tab: 'sectors' }), count: category ? category.sectors.length : tree.sectorCount },
              ]}
            />
          ) : null}

          <ListToolbar
            params={params}
            config={config}
            total={list.total}
            placeholder={selection.tab === 'sectors' ? 'Search sectors by name, code or description…' : 'Search bots by name, tagline or expertise…'}
          />
          <ResourceView
            module="taxonomy-browser"
            view="list"
            toggle={false}
            showCount={false}
            openInPlace
            dense
            selectedId={openId}
            items={items}
            badgeHeader="Status"
            sortHrefs={
              selection.tab === 'sectors'
                ? {
                    title: sortToggle(BROWSER_PATH, params, config, { asc: 'name', desc: 'name-desc' }),
                    personas: sortToggle(BROWSER_PATH, params, config, { asc: 'personas-asc', desc: 'personas' }),
                  }
                : { title: sortToggle(BROWSER_PATH, params, config, { asc: 'name', desc: 'name-desc' }) }
            }
            empty={{
              title: params.q || Object.keys(params.filters).length ? 'Nothing matches' : selection.tab === 'sectors' ? 'No sectors here' : 'No bots filed here yet',
              description:
                params.q || Object.keys(params.filters).length
                  ? 'Clear the search or a filter, or pick another node on the left.'
                  : selection.tab === 'sectors'
                    ? 'Add a sector to give this field its specialisms.'
                    : 'Design one from this category’s workspace, or file an existing bot under it from its editor.',
            }}
          />
          <ListPagination pathname={BROWSER_PATH} params={params} config={config} total={list.total} />
        </section>
      </div>

      {open && card && openId ? (
        <BrowserSheet open={open} openId={openId} card={card} items={items} closeHref={closeHref} params={params} config={config} selection={selection} />
      ) : null}
    </div>
  );
}

type Params = ReturnType<typeof parseBrowser>['params'];
type Config = ReturnType<typeof parseBrowser>['config'];

function personaItem(row: BrowserPersonaRow, selection: Selection, params: Params, config: Config): ResourceItem {
  const where =
    selection.sec !== null ? null : typeof selection.cat === 'number' ? row.sectorName ?? '—' : [row.categoryName, row.sectorName].filter(Boolean).join(' › ') || '—';
  return {
    id: openKey({ kind: 'persona', id: row.id }),
    title: row.name,
    subtitle: row.tagline,
    href: withOpen(params, config, { kind: 'persona', id: row.id }),
    media: (
      <PersonaMark
        personaKey={row.slug}
        categoryKey={row.categorySlug}
        sectorKey={row.sectorSlug}
        categoryIndex={row.categoryId}
        accent={row.accentColor}
        className="size-7 shrink-0"
      />
    ),
    meta: [
      ...(where === null ? [] : [{ key: 'where', label: typeof selection.cat === 'number' ? 'Sector' : 'Category › sector', value: <span className="text-xs">{where}</span> }]),
      // Messages are not a column: at 1280px the table has ~700px beside the
      // tree, and nearly every bot reads 0 today. "Most messages" stays in Sort.
      { key: 'audience', label: 'Audience', value: <span className="font-mono text-xs">{row.audienceType ?? '—'}</span> },
    ],
    badges: [
      row.isActive ? { label: 'Live', tone: 'green' as const } : { label: 'Not live', tone: 'slate' as const },
      ...(row.isTutor ? [{ label: 'Tutor', tone: 'brand' as const, title: 'Has a curriculum scope' }] : []),
      ...(row.isFeatured ? [{ label: 'Featured', tone: 'amber' as const }] : []),
    ],
    actions: [
      { label: 'Edit', href: `/admin/personas/${row.id}`, icon: <Pencil className="size-4" /> },
      ...(row.isActive ? [{ label: 'View on site', href: `/personas/${row.slug}`, icon: <ExternalLink className="size-4" /> }] : []),
    ],
  };
}

function sectorItem(row: BrowserSectorRow, selection: Selection, params: Params, config: Config): ResourceItem {
  return {
    id: openKey({ kind: 'sector', id: row.id }),
    title: row.name,
    subtitle: row.description,
    href: withOpen(params, config, { kind: 'sector', id: row.id }),
    meta: [
      ...(typeof selection.cat === 'number' ? [] : [{ key: 'category', label: 'Category', value: <span className="text-xs">{row.categoryName}</span> }]),
      { key: 'personas', label: 'Bots live', value: <span className="font-mono text-xs">{row.live}/{row.total}</span> },
      {
        key: 'risk',
        label: 'Risk',
        value: row.riskLevel ? <Badge tone={RISK_TONE[row.riskLevel] ?? 'slate'} title={RISK_MEANING[row.riskLevel]}>{row.riskLevel}</Badge> : '—',
      },
      // Suitability (B2C/B2B/B2G) is on the card; the table has no room for it beside the tree.
    ],
    badges: row.isActive ? [] : [{ label: 'Off', tone: 'slate' }],
    actions: [
      { label: 'Show its bots', href: selectionHref(params, config, selection, { sec: row.id }), icon: <Layers className="size-4" /> },
      { label: 'Edit sector', href: `/admin/sectors/${row.id}`, icon: <Pencil className="size-4" /> },
    ],
  };
}

function NodeHeader({
  tree,
  selection,
  header,
  params,
  config,
}: {
  tree: Tree;
  selection: Selection;
  header: Awaited<ReturnType<typeof categoryHeader>> | null;
  params: Params;
  config: Config;
}) {
  const category = typeof selection.cat === 'number' ? tree.categories.find((c) => c.id === selection.cat) : undefined;
  const sector = selection.sec !== null ? category?.sectors.find((s) => s.id === selection.sec) : undefined;

  if (sector && category) {
    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">
            <Link href={selectionHref(params, config, selection, { cat: category.id })} scroll={false} className="hover:underline">{category.name}</Link> › sector
          </p>
          <h2 className="text-xl font-bold tracking-tight">{sector.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{sector.live}/{sector.total} bots live</span>
            {sector.riskLevel ? <Badge tone={RISK_TONE[sector.riskLevel] ?? 'slate'} title={RISK_MEANING[sector.riskLevel]}>{sector.riskLevel}</Badge> : null}
            {!sector.isActive ? <Badge tone="slate">Switched off</Badge> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={withOpen(params, config, { kind: 'sector', id: sector.id })}
            scroll={false}
            className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]"
          >
            Sector card
          </Link>
          <Link href={`/admin/sectors/${sector.id}`} className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
            <Pencil className="size-3.5" /> Edit
          </Link>
        </div>
      </div>
    );
  }

  if (category && header) {
    return (
      // Buttons under the text below sm: beside it on a phone they left the
      // name a 90px column, one word per line.
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <PersonaMark personaKey={header.slug} categoryKey={header.slug} categoryIndex={header.id} accent={header.color ?? '#6366f1'} className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight">{header.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{category.live}/{category.total} bots live</span>
              <span>· {category.sectors.length} sectors</span>
              <span>· {header.audienceCount} audiences</span>
              {header.riskLevel ? <Badge tone={RISK_TONE[header.riskLevel] ?? 'slate'} title={RISK_MEANING[header.riskLevel]}>{header.riskLevel}</Badge> : null}
              {!header.isActive ? <Badge tone="slate">Hidden</Badge> : null}
            </p>
            {header.description ? <p className="mt-2 line-clamp-2 text-sm text-slate-400">{header.description}</p> : null}
            {header.marketSize ? (
              <p className="mt-1 text-xs text-slate-500">
                UK market {header.marketSize}
                {header.growth ? ` · growth ${header.growth}` : ''} · <span className="font-mono">/{header.slug}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* The workspace holds the brief, its audiences and the design workbench. */}
          <Link href={`/admin/taxonomy/${header.id}`} className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700">
            <FlaskConical className="size-3.5" /> Workspace
          </Link>
          <Link href={`/admin/categories/${header.id}`} className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
            <Pencil className="size-3.5" /> Edit
          </Link>
        </div>
      </div>
    );
  }

  if (selection.cat === 'none') {
    return (
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight">No category</h2>
        <p className="mt-1 text-sm text-slate-400">Bots filed under no category. Give each one a sector in its editor and it lands in the tree.</p>
      </div>
    );
  }

  if (selection.pillar) {
    const pillar = PILLAR_BY_ID[selection.pillar];
    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">Market</p>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: pillar.color }} />
            {pillar.label}
            <Badge tone={pillar.status === 'live' ? 'green' : 'slate'}>{pillar.status === 'live' ? 'Sold now' : 'Planned'}</Badge>
          </h2>
          <p className="mt-1 text-sm text-slate-400">{pillar.description}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {tree.categories.length} {tree.categories.length === 1 ? 'category' : 'categories'} · {tree.all.live}/{tree.all.total} bots live
          </p>
        </div>
        <Link href={`/admin/markets/${pillar.id}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
          Market page
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold tracking-tight">All categories</h2>
      <p className="mt-1 font-mono text-xs text-slate-500">
        {tree.categories.length} categories · {tree.sectorCount} sectors · {tree.all.live}/{tree.all.total} bots live
      </p>
    </div>
  );
}

/**
 * The six markets as chips above the tree. Picking one narrows the tree to
 * the fields that serve it and the list to its bots (`?pillar=`).
 */
function MarketPicker({
  bots,
  selection,
  params,
  config,
}: {
  bots: Awaited<ReturnType<typeof botPillars>>;
  selection: Selection;
  params: Params;
  config: Config;
}) {
  const chip = 'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors';
  return (
    <nav aria-label="Markets" className="mb-3 flex flex-wrap gap-1">
      <Link
        href={selectionHref(params, config, selection, { pillar: null })}
        scroll={false}
        aria-current={selection.pillar === null ? 'page' : undefined}
        className={`${chip} ${selection.pillar === null ? 'border-brand-500/60 bg-brand-500/15 text-white' : 'border-slate-200 text-slate-400 hover:text-slate-200 dark:border-white/10'}`}
      >
        All markets
      </Link>
      {PILLARS.map((pillar) => {
        const mine = bots.filter((b) => b.pillar === pillar.id);
        const current = selection.pillar === pillar.id;
        return (
          <Link
            key={pillar.id}
            href={selectionHref(params, config, selection, { pillar: pillar.id })}
            scroll={false}
            aria-current={current ? 'page' : undefined}
            title={`${pillar.label} — ${mine.filter((b) => b.isActive).length} of ${mine.length} bots live${pillar.status === 'planned' ? ' · planned' : ''}`}
            className={`${chip} ${current ? 'border-brand-500/60 bg-brand-500/15 text-white' : 'border-slate-200 text-slate-400 hover:text-slate-200 dark:border-white/10'} ${pillar.status === 'planned' && !current ? 'opacity-70' : ''}`}
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />
            {pillar.short}
            <span className="font-mono text-[10px] text-slate-500">{mine.length}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BrowserSheet({
  open,
  openId,
  card,
  items,
  closeHref,
  params,
  config,
  selection,
}: {
  open: OpenRef;
  openId: string;
  card: NonNullable<Awaited<ReturnType<typeof personaCard>> | Awaited<ReturnType<typeof sectorCard>>>;
  items: ResourceItem[];
  closeHref: string;
  params: Params;
  config: Config;
  selection: Selection;
}) {
  const index = items.findIndex((item) => item.id === openId);
  const { previous, next } = neighbours(items, index);
  const actions = (
    <>
      {index >= 0 ? <span className="mr-1 font-mono text-[11px] text-slate-500">{index + 1}/{items.length}</span> : null}
      <StepLink href={previous?.href} label={`Previous: ${previous?.title ?? ''}`} icon={<ChevronUp className="size-4" />} />
      <StepLink href={next?.href} label={`Next: ${next?.title ?? ''}`} icon={<ChevronDown className="size-4" />} />
    </>
  );

  if (open.kind === 'persona' && 'slug' in card && 'audienceSegments' in card) {
    return (
      <RouteSheet
        openId={openId}
        closeHref={closeHref}
        returnFocusId={`row-${openId}`}
        eyebrow={[card.categoryName, card.sectorName].filter(Boolean).join(' › ') || 'Bot'}
        title={card.name}
        subtitle={card.tagline ?? undefined}
        actions={actions}
        footer={
          <>
            {card.isActive ? (
              <Link href={`/personas/${card.slug}`} className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
                <ExternalLink className="size-3.5" /> View on site
              </Link>
            ) : null}
            <Link href={`/admin/personas/${card.id}`} className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700">
              <Pencil className="size-3.5" /> Edit
            </Link>
          </>
        }
      >
        <PersonaSheetBody card={card} sectorHref={card.sectorId ? selectionHref(params, config, selection, { sec: card.sectorId }) : null} />
      </RouteSheet>
    );
  }

  if (open.kind === 'sector' && 'interactionModes' in card) {
    return (
      <RouteSheet
        openId={openId}
        closeHref={closeHref}
        returnFocusId={`row-${openId}`}
        eyebrow={card.categoryName}
        title={card.name}
        subtitle={card.code ?? undefined}
        actions={actions}
        footer={
          <>
            <Link href={`/admin/sectors/${card.id}`} className="inline-flex h-9 items-center gap-2 rounded-control border hairline px-3 text-xs font-semibold hover:bg-white/[0.03]">
              <Pencil className="size-3.5" /> Edit sector
            </Link>
            <Link
              href={selectionHref(params, config, selection, { sec: card.id })}
              scroll={false}
              className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-600 px-3 text-xs font-semibold text-on-brand hover:bg-brand-700"
            >
              <Layers className="size-3.5" /> Show its {card.total} bots
            </Link>
          </>
        }
      >
        <SectorSheetBody card={card} />
      </RouteSheet>
    );
  }
  return null;
}

function StepLink({ href, label, icon }: { href?: string; label: string; icon: React.ReactNode }) {
  const className = 'grid size-8 place-items-center rounded-lg text-slate-400 transition-colors';
  if (!href) return <span aria-hidden className={`${className} opacity-30`}>{icon}</span>;
  return (
    <Link href={href} scroll={false} replace aria-label={label} title={label} className={`${className} hover:bg-white/5 hover:text-slate-200`}>
      {icon}
    </Link>
  );
}
