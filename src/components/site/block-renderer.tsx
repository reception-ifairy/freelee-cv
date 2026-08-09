import { layoutFor, renderBlockContent, type BlockRow } from '@/lib/blocks/registry';
import { blockMeta } from '@/lib/blocks/catalog';
import { outerClasses, innerClasses } from '@/lib/blocks/layout';
import { BlockChrome } from './block-chrome';
import { BLOCK_ANCHOR_ATTR, type EditScope } from './editor-types';
import { cn } from '@/lib/utils';

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
 *
 * When `canEdit` is set, each top-level block additionally carries its admin
 * chrome. That is gated on the server, so a visitor never receives the editing
 * components at all — hiding them in CSS alone would ship the whole editor to
 * everyone.
 */
export async function BlockRenderer({
  rows,
  canEdit = false,
  scope,
}: {
  rows: BlockRow[];
  canEdit?: boolean;
  scope?: EditScope;
}) {
  // Admins see hidden blocks too, faded, so a hidden block can be found and
  // brought back without going to a separate screen.
  const visible = canEdit ? rows : rows.filter((row) => row.isVisible);

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
      const kids = blockMeta(row.type)?.container
        ? (childrenByParent.get(row.id) ?? []).filter((kid) => kid.isVisible || canEdit)
        : [];
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

  const drawn = rendered.filter((entry) => entry.content !== null);

  return (
    <>
      {drawn.map(({ row, layout, content }, index) => {
        const outer = outerClasses(layout);
        return (
          <div
            key={row.id}
            {...(canEdit ? { [BLOCK_ANCHOR_ATTR]: row.id } : {})}
            className={cn(outer || undefined, canEdit && 'relative', canEdit && !row.isVisible && 'opacity-40')}
          >
            {canEdit && scope ? (
              <BlockChrome
                block={{
                  id: row.id,
                  type: row.type,
                  isVisible: row.isVisible,
                  config: (row.config ?? {}) as Record<string, unknown>,
                  layout: row.layout,
                  parentId: row.parentId ?? null,
                }}
                scope={scope}
                isFirst={index === 0}
                isLast={index === drawn.length - 1}
              />
            ) : null}
            <div className={innerClasses(layout)}>{content}</div>
          </div>
        );
      })}
    </>
  );
}
