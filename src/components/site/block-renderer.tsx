import { layoutFor, renderBlockContent, type BlockRow } from '@/lib/blocks/registry';
import { outerClasses, innerClasses } from '@/lib/blocks/layout';

/**
 * Renders an ordered list of blocks, each wrapped in its layout band.
 *
 * The wrapper is a no-op for the eight blocks that predate this system: they
 * carry their own `<section className="container-app py-N">` with asymmetric
 * spacing, so their catalog default layout is `full` width with no background
 * and no padding, which produces a bare `<div class="w-full">` and changes
 * nothing. An admin can still switch any of them to a padded or tinted band —
 * it composes around the existing markup rather than fighting it.
 */
export async function BlockRenderer({ rows }: { rows: BlockRow[] }) {
  const visible = rows.filter((row) => row.isVisible);

  // Only visible blocks run their own database queries — the same win the
  // original section system introduced over the fixed page it replaced.
  const rendered = await Promise.all(
    visible.map(async (row) => ({
      row,
      layout: layoutFor(row.type, row.layout),
      content: await renderBlockContent(row.type, row.config),
    })),
  );

  return (
    <>
      {rendered.map(({ row, layout, content }) => {
        if (content === null) return null;
        const outer = outerClasses(layout);
        return (
          <div key={row.id} className={outer || undefined}>
            <div className={innerClasses(layout)}>{content}</div>
          </div>
        );
      })}
    </>
  );
}
