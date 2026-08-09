'use client';

import {
  BLOCK_WIDTHS, BLOCK_COLUMNS, BLOCK_BACKGROUNDS, BLOCK_PADDINGS, BLOCK_VISIBILITY,
  WIDTH_LABELS, BACKGROUND_LABELS, PADDING_LABELS, VISIBILITY_LABELS,
  type BlockLayout,
} from '@/lib/blocks/layout';
import { GridSelect } from '@/components/ui/grid-select';
import { Label } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';

/**
 * The grid system, as five dropdowns.
 *
 * Identical for every block type — which is the point of storing layout in its
 * own column rather than inside each block's config. A block added later gets
 * this panel with no work at all.
 */
export function BlockLayoutControls({
  layout,
  onChange,
  supportsColumns,
}: {
  layout: BlockLayout;
  onChange: (next: BlockLayout) => void;
  supportsColumns?: boolean;
}) {
  const set = <K extends keyof BlockLayout>(key: K, value: BlockLayout[K]) => onChange({ ...layout, [key]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Control label="Width" help="How wide the content runs. 'Narrow' is comfortable reading width for long text.">
        <GridSelect
          options={BLOCK_WIDTHS.map((w) => ({ id: w, label: WIDTH_LABELS[w] }))}
          value={layout.width}
          onChange={(v) => set('width', v as BlockLayout['width'])}
          columns={3}
        />
      </Control>

      <Control label="Background" help="A tinted or dark band behind this block. Colours come from your active theme, so changing the theme repaints it.">
        <GridSelect
          options={BLOCK_BACKGROUNDS.map((b) => ({ id: b, label: BACKGROUND_LABELS[b] }))}
          value={layout.background}
          onChange={(v) => set('background', v as BlockLayout['background'])}
          columns={2}
        />
      </Control>

      <Control label="Spacing" help="Vertical breathing room above and below. Set to none when two blocks should read as one band.">
        <GridSelect
          options={BLOCK_PADDINGS.map((p) => ({ id: p, label: PADDING_LABELS[p] }))}
          value={layout.paddingY}
          onChange={(v) => set('paddingY', v as BlockLayout['paddingY'])}
          columns={2}
        />
      </Control>

      {supportsColumns ? (
        <Control label="Columns" help="How many across on a wide screen. It always collapses to one column on a phone.">
          <GridSelect
            options={BLOCK_COLUMNS.map((c) => ({ id: String(c), label: `${c}` }))}
            value={String(layout.columns)}
            onChange={(v) => set('columns', Number(v) as BlockLayout['columns'])}
            columns={4}
          />
        </Control>
      ) : null}

      <Control label="Show on" help="Hide this block on phones or on desktops — useful for a short mobile version of a long block.">
        <GridSelect
          options={BLOCK_VISIBILITY.map((v) => ({ id: v, label: VISIBILITY_LABELS[v] }))}
          value={layout.visibleOn}
          onChange={(v) => set('visibleOn', v as BlockLayout['visibleOn'])}
          columns={3}
        />
      </Control>
    </div>
  );
}

function Control({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Label className="mb-0">{label}</Label>
        <HelpTip title={label} body={help} />
      </div>
      {children}
    </div>
  );
}
