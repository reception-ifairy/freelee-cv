import { layoutFor, renderBlockContent, type BlockRow } from '@/lib/blocks/registry';
import { blockMeta } from '@/lib/blocks/catalog';
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
 *
 * `rows` is the **whole** scope including nested children; this component
 * partitions them, so a container renders its own children and they are not
 * also drawn at the top level.
 */
export async function BlockRenderer({ rows }: { rows: BlockRow[] }) {
  const visible = rows.filter((row) => row.isVisible);

  const childrenByParent = new Map<number, BlockRow[]>();
  for (const row of visible) {
    if (row.parentId == null) continue;
    const list = childrenByParent.get(row.parentId) ?? [];
    list.push(row);
    childrenByParent.set(row.parentId, list);
  }

  const topLevel = visible.filter((row) => row.parentId == null);

  // Only visible blocks run their own database queries — the same win the
  // original section system introduced over the fixed page it replaced.
  const rendered = await Promise.all(
    topLevel.map(async (row) => {
      const layout = layoutFor(row.type, row.layout);

      // A container's children are rendered bare and dropped into its grid;
      // they do not get their own band, or every column would carry the
      // parent's padding a second time.
      const kids = blockMeta(row.type)?.container ? (childrenByParent.get(row.id) ?? []) : [];
      const children =
        kids.length > 0
          ? await Promise.all(
              kids.map(async (kid) => (
                <div key={kid.id}>{await renderBlockContent(kid.type, kid.config, layoutFor(kid.type, kid.layout))}</div>
              )),
            )
          : undefined;

      return { row, layout, content: await renderBlockContent(row.type, row.config, layout, children) };
    }),
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
