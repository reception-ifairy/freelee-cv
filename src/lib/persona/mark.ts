/**
 * A persona's visual identity, generated from what it *is*.
 *
 * The platform's standing rule: **a persona is never represented by a human
 * face.** Not a stock photo, not a generated portrait, not an illustrated
 * mascot. An AI specialist is not a person, and dressing one up as a person
 * makes a promise the product does not keep.
 *
 * What it is instead is a mark — closer to a maker's stamp or a credential
 * seal than an avatar. Three inputs, matching the three axes a card has to
 * show:
 *
 *   category → the field colour and the cell geometry
 *   sector   → the grid's density and rhythm, so two specialists in one
 *              sector are visibly relatives
 *   persona  → which cells fill, so relatives are still individuals
 *
 * Pure and deterministic: the same persona always produces the same mark, with
 * no image files, no network request and no dependency. That matters more than
 * it sounds — an identity that changes between renders is not an identity.
 *
 * Symmetric about the vertical axis, which is the whole difference between a
 * mark and a mess. Random cells read as noise; mirrored cells read as
 * something made on purpose.
 */

/**
 * FNV-1a with a murmur3 avalanche.
 *
 * Small, fast and stable across runtimes — which a hash used for *identity*
 * has to be. The avalanche is not optional decoration: plain FNV-1a leaves its
 * low bits poorly mixed for short, similar inputs, and category slugs are
 * exactly that. Taking `hash % 4` to pick a shape gave 9 squares and 1 circle
 * across the 20 real categories; with the finalizer the same 20 spread evenly.
 */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A deterministic stream of numbers from one seed.
 *
 * Successive calls must not correlate — reusing the same hash for shape, then
 * density, then each cell would make every mark in a category share a visible
 * pattern.
 */
function stream(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/** The cell shapes a category can use. Geometry, not decoration — it is the second thing that tells two categories apart after colour. */
export type MarkShape = 'square' | 'circle' | 'chamfer' | 'diamond';
const SHAPES: MarkShape[] = ['square', 'circle', 'chamfer', 'diamond'];

export type MarkSpec = {
  /** 5 or 7 columns. Denser grids read as more specialised, which is what a sector is. */
  grid: number;
  shape: MarkShape;
  /** Row-major, already mirrored. True = filled. */
  cells: boolean[];
  /** 0–1, how strongly the field behind the glyph is tinted. */
  wash: number;
};

/**
 * Builds the mark's geometry.
 *
 * `categoryKey` and `sectorKey` are slugs (or nulls). A persona with no
 * category still gets a mark — an unfiled specialist is a normal state, not an
 * error, and rendering nothing would be worse than rendering something plain.
 */
export function markSpec(
  personaKey: string,
  categoryKey?: string | null,
  sectorKey?: string | null,
  /**
   * The category's own id, when the caller has it.
   *
   * Shape is picked from this rather than from the hash, because a hash cannot
   * guarantee spread across a set as small as twenty. Hashing the real slugs
   * gave 10 circles and 1 chamfer — half the catalogue sharing a silhouette,
   * which defeats the point of having one. Sequential ids cycle through the
   * four shapes exactly evenly.
   *
   * Falls back to the hash when unknown, so an uncategorised persona still
   * gets a stable mark.
   */
  categoryIndex?: number | null,
): MarkSpec {
  const categoryHash = hash(categoryKey ?? 'uncategorised');
  const sectorHash = hash(sectorKey ?? categoryKey ?? 'general');
  const personaHash = hash(personaKey);

  // Category picks the geometry, so a whole category shares a silhouette.
  const shape = SHAPES[
    (typeof categoryIndex === 'number' ? Math.abs(categoryIndex) : categoryHash) % SHAPES.length
  ];

  // Sector picks the grid. 7 columns for roughly a third of sectors, so the
  // catalogue has rhythm rather than one uniform texture.
  const grid = sectorHash % 3 === 0 ? 7 : 5;

  // Density is a narrow band on purpose: below ~35% a mark looks unfinished,
  // above ~60% it turns into a solid block and stops being distinguishable.
  const density = 0.36 + ((sectorHash >>> 8) % 24) / 100;

  const half = Math.ceil(grid / 2);
  const next = stream(personaHash ^ sectorHash);
  const cells: boolean[] = new Array(grid * grid).fill(false);

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < half; col++) {
      const on = next() < density;
      cells[row * grid + col] = on;
      // Mirror. The centre column of an odd grid maps to itself, which is why
      // `half` is a ceil and this assignment is idempotent there.
      cells[row * grid + (grid - 1 - col)] = on;
    }
  }

  // A mark that came out (nearly) empty is a failure of the dice, not a
  // design. Fall back to a cross: symmetric, obviously deliberate, and — the
  // part that matters — it satisfies the very condition that triggered it.
  //
  // The first version lit only the centre column's inner rows, which produces
  // `grid - 2` cells against a `grid` threshold: a fallback that could never
  // clear its own bar. The property test caught it; by eye it would have
  // looked fine.
  if (cells.filter(Boolean).length < grid) {
    const centre = Math.floor(grid / 2);
    for (let i = 0; i < grid; i++) {
      cells[i * grid + centre] = true;
      cells[centre * grid + i] = true;
    }
  }

  return { grid, shape, cells, wash: 0.08 + ((categoryHash >>> 16) % 8) / 100 };
}

/** The SVG path for one cell, in a 0–1 unit box. Kept as geometry rather than JSX so the generator stays testable without React. */
export function cellPath(shape: MarkShape, x: number, y: number, size: number): string {
  const r = size * 0.22;
  switch (shape) {
    case 'circle':
      return `M ${x + size / 2} ${y} a ${size / 2} ${size / 2} 0 1 0 0.01 0 Z`;
    case 'diamond':
      return `M ${x + size / 2} ${y} L ${x + size} ${y + size / 2} L ${x + size / 2} ${y + size} L ${x} ${y + size / 2} Z`;
    case 'chamfer':
      return `M ${x + r} ${y} L ${x + size} ${y} L ${x + size} ${y + size - r} L ${x + size - r} ${y + size} L ${x} ${y + size} L ${x} ${y + r} Z`;
    default:
      return `M ${x + r} ${y} L ${x + size - r} ${y} Q ${x + size} ${y} ${x + size} ${y + r} L ${x + size} ${y + size - r} Q ${x + size} ${y + size} ${x + size - r} ${y + size} L ${x + r} ${y + size} Q ${x} ${y + size} ${x} ${y + size - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  }
}
