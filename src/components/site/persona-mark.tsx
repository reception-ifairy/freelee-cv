import { markSpec, cellPath } from '@/lib/persona/mark';
import { cn } from '@/lib/utils';

/**
 * A persona's mark, as inline SVG.
 *
 * Inline rather than an `<img>` for three reasons that all matter here: it
 * costs no request, it inherits the theme's colours, and — the important one —
 * **there is no image to swap for a photograph.** The rule that a persona is
 * never a human face is easier to keep when there is nowhere to put one.
 *
 * `accent` is the category's colour where there is one, falling back to the
 * persona's own. Two specialists in the same field should look like they work
 * in the same field.
 */
export function PersonaMark({
  personaKey,
  categoryKey,
  sectorKey,
  categoryIndex,
  accent,
  className,
  title,
}: {
  personaKey: string;
  categoryKey?: string | null;
  sectorKey?: string | null;
  /** The category's id. Picks the cell shape — see markSpec for why a hash cannot. */
  categoryIndex?: number | null;
  accent: string;
  className?: string;
  /** Only pass this where the mark is the sole identifier. Beside a visible name it is decoration and must stay silent. */
  title?: string;
}) {
  const spec = markSpec(personaKey, categoryKey, sectorKey, categoryIndex);
  const unit = 100 / spec.grid;
  // Cells sit inside a gutter so the glyph never touches the field's edge —
  // the breathing room is most of what separates a mark from a QR code.
  const pad = unit * 0.16;
  const size = unit - pad * 2;

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('shrink-0 overflow-hidden', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="100" height="100" rx="18" fill={accent} opacity={spec.wash} />
      <rect width="100" height="100" rx="18" fill="none" stroke={accent} strokeOpacity="0.28" strokeWidth="1.5" />

      <g fill={accent}>
        {spec.cells.map((on, i) => {
          if (!on) return null;
          const row = Math.floor(i / spec.grid);
          const col = i % spec.grid;
          // Cells nearer the centre are more opaque, which gives the glyph a
          // weight and stops a symmetric grid reading as flat wallpaper.
          const distance = Math.abs(col - (spec.grid - 1) / 2) / ((spec.grid - 1) / 2 || 1);
          return (
            <path
              key={i}
              d={cellPath(spec.shape, col * unit + pad, row * unit + pad, size)}
              opacity={0.92 - distance * 0.45}
            />
          );
        })}
      </g>
    </svg>
  );
}
