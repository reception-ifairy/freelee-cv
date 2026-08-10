/**
 * The palette vocabulary behind the theme composer.
 *
 * Plain module — the composer (client) and the seed/verify scripts both use it.
 *
 * **Why a ramp generator rather than a colour picker per shade.** The theme
 * table stores tokens that override Tailwind's colour scales, but the admin
 * form only ever exposed three of them (`brand-500`, `brand-600`,
 * `accent-500`). Change the brand to green and the other seven brand stops
 * stayed indigo, so hovers, tints and dark-mode surfaces quietly disagreed with
 * the colour that had just been chosen. Generating the whole ramp from one seed
 * is what makes a picked colour actually take.
 *
 * Ported in spirit from vizai.art's `ThemeChanger`, which ships complete
 * hand-written palettes. Presets here are the same idea; the ramp generator is
 * the part vizai does by hand.
 */

/* -------------------------------------------------------------------------- */
/*  Colour maths                                                              */
/* -------------------------------------------------------------------------- */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

export function isHex(value: string): boolean {
  return hexToRgb(value) !== null;
}

type Hsl = { h: number; s: number; l: number };

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 };
}

/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Present because a composer that lets an admin pick unreadable text is worse
 * than no composer: the failure only shows up for the people least able to
 * work around it.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return 1;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastVerdict = 'AAA' | 'AA' | 'AA Large' | 'Fail';

/** WCAG thresholds for normal body text: 7 for AAA, 4.5 for AA, 3 for large text only. */
export function wcagVerdict(ratio: number): ContrastVerdict {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/**
 * The bar for icons, borders and other **non-text** content is 3:1, not 4.5:1
 * (WCAG 2.1, 1.4.11).
 *
 * Worth its own function because judging a colour by the wrong threshold cuts
 * both ways: this project's accent is used for one small icon, and reporting it
 * against the body-text bar made it look broken in a way that would have led to
 * changing a colour for the wrong reason.
 */
export function wcagNonTextVerdict(ratio: number): ContrastVerdict {
  if (ratio >= 4.5) return 'AAA';
  if (ratio >= 3) return 'AA';
  return 'Fail';
}

/* -------------------------------------------------------------------------- */
/*  Ramp generation                                                           */
/* -------------------------------------------------------------------------- */

export const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStop = (typeof RAMP_STOPS)[number];

/**
 * The stop the seed is pinned to.
 *
 * 600, because that is what the UI paints primary buttons and links with — and
 * the field is labelled "the colour buttons and links should read as". Anchoring
 * anywhere else makes the promise false: an earlier version anchored to whichever
 * stop the seed's own lightness suggested, so a deep emerald landed at 800 and
 * the button came out mint.
 */
const ANCHOR_STOP: RampStop = 600;

const LIGHTEST = 0.97;
const DARKEST = 0.2;

/**
 * Builds a 50–900 ramp from a single seed colour.
 *
 * **The seed becomes `brand-600` exactly**, and the rest is interpolated out to
 * near-white and near-black around it. So the colour an admin picks is the
 * colour on the buttons — which is the whole promise of the field.
 *
 * Two earlier versions got this wrong, both caught by testing rather than
 * reading. Forcing a fixed lightness per stop turned Emerald Forest's deep
 * `#059669` into neon `#08f7ad`; anchoring to the seed's *natural* stop kept
 * the colour in the ramp but parked it at 800, so the button was still mint.
 */
export function rampFromSeed(seed: string, prefix: string): Record<string, string> {
  const rgb = hexToRgb(seed);
  if (!rgb) return {};

  const { h, s, l } = rgbToHsl(rgb);
  // A grey seed would otherwise generate ten identical greys.
  const saturation = s < 0.05 ? 0.05 : s;

  const anchorIndex = RAMP_STOPS.indexOf(ANCHOR_STOP);

  const out: Record<string, string> = {};
  RAMP_STOPS.forEach((stop, index) => {
    let lightness: number;
    if (index === anchorIndex) {
      lightness = l;
    } else if (index < anchorIndex) {
      // Toward the light end.
      const t = index / anchorIndex;
      lightness = LIGHTEST + (l - LIGHTEST) * t;
    } else {
      // Toward the dark end.
      const t = (index - anchorIndex) / (RAMP_STOPS.length - 1 - anchorIndex);
      lightness = l + (DARKEST - l) * t;
    }

    // Pale tints look garish at full saturation; deep shades look muddy.
    const distance = Math.abs(index - anchorIndex) / (RAMP_STOPS.length - 1);
    const stopSaturation = Math.min(1, saturation * (1 - distance * 0.25));

    out[`${prefix}-${stop}`] = rgbToHex(hslToRgb({ h, s: stopSaturation, l: lightness }));
  });

  return out;
}

/**
 * Surfaces are the greys: page background, cards, borders and body text.
 *
 * Optional, and empty by default. The site paints those from Tailwind's slate
 * scale, and the theme mechanism overrides `--color-<key>` — so tinting them is
 * a matter of writing `slate-*` tokens, with no component changes at all.
 *
 * Empty means "write nothing", which is why turning this on cannot regress a
 * site that never used it: the compiled-in slate is left exactly as it was.
 */
export type PaletteSeeds = { brand: string; accent: string; surface?: string };

export const SURFACE_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Tailwind's slate lightness curve, so a neutral seed reproduces the shipped greys. */
const SURFACE_LIGHTNESS: Record<(typeof SURFACE_STOPS)[number], number> = {
  50: 0.98, 100: 0.96, 200: 0.91, 300: 0.84, 400: 0.65,
  500: 0.47, 600: 0.35, 700: 0.28, 800: 0.17, 900: 0.11, 950: 0.05,
};

/**
 * Tints every grey towards one hue.
 *
 * Saturation is deliberately tiny — a "warm paper" or "cool slate" look is a
 * few percent, not a colour. Past about 12% the interface stops reading as
 * neutral and starts competing with the brand.
 */
export function surfaceRamp(seed: string): Record<string, string> {
  const rgb = hexToRgb(seed);
  if (!rgb) return {};

  const { h, s } = rgbToHsl(rgb);
  const saturation = Math.min(s, 0.12);

  const out: Record<string, string> = {};
  for (const stop of SURFACE_STOPS) {
    out[`slate-${stop}`] = rgbToHex(hslToRgb({ h, s: saturation, l: SURFACE_LIGHTNESS[stop] }));
  }
  return out;
}

/** The complete token set the root layout writes as `--color-<key>`. */
export function tokensFromSeeds({ brand, accent, surface }: PaletteSeeds): Record<string, string> {
  return {
    // Only written when a surface tint was actually chosen; otherwise the
    // compiled-in slate scale is left alone.
    ...(surface ? surfaceRamp(surface) : {}),
    ...rampFromSeed(brand, 'brand'),
    // Only the three accent stops the UI actually uses today — writing ten
    // would be tokens nothing reads.
    ...Object.fromEntries(
      Object.entries(rampFromSeed(accent, 'accent')).filter(([key]) =>
        ['accent-400', 'accent-500', 'accent-600'].includes(key),
      ),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*  Presets                                                                   */
/* -------------------------------------------------------------------------- */

export type PalettePreset = {
  id: string;
  name: string;
  description: string;
  seeds: PaletteSeeds;
};

/**
 * Starting points, not a cage — picking one fills the seeds and the admin can
 * then move either colour. Names and several of the pairings are carried over
 * from vizai.art's palette set.
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  { id: 'indigo', name: 'Indigo (default)', description: 'The shipped look — confident and neutral.', seeds: { brand: '#4f46e5', accent: '#d97706' } },
  { id: 'dark-luxury', name: 'Dark Luxury', description: 'Champagne on near-black. Quiet and expensive.', seeds: { brand: '#d4c5a0', accent: '#8c7851', surface: '#6b6357' } },
  { id: 'minimal-light', name: 'Minimal Light', description: 'Clean editorial blue with plenty of air.', seeds: { brand: '#2563eb', accent: '#0ea5e9' } },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', description: 'Electric cyan against deep slate.', seeds: { brand: '#06b6d4', accent: '#a855f7' } },
  { id: 'crimson-sunset', name: 'Crimson Sunset', description: 'Warm reds fading into orange.', seeds: { brand: '#e11d48', accent: '#fb923c' } },
  { id: 'emerald-forest', name: 'Emerald Forest', description: 'Deep green, calm and natural.', seeds: { brand: '#059669', accent: '#a7f3d0' } },
  { id: 'amethyst', name: 'Amethyst Dream', description: 'Rich purple with a soft lilac accent.', seeds: { brand: '#9333ea', accent: '#c084fc' } },
  { id: 'aurora-mint', name: 'Aurora Mint', description: 'Cool teal with a bright mint highlight.', seeds: { brand: '#14b8a6', accent: '#5eead4' } },
  { id: 'luminous-paper', name: 'Luminous Paper', description: 'Soft blue on warm white — very legible.', seeds: { brand: '#2f80ed', accent: '#8ac8ff', surface: '#6b7a8f' } },
  { id: 'pure-black', name: 'Pure Black', description: 'Stark red on black. High drama.', seeds: { brand: '#c1121f', accent: '#ff9c9c' } },
];

export function presetById(id: string): PalettePreset | undefined {
  return PALETTE_PRESETS.find((preset) => preset.id === id);
}

/**
 * Best-effort recovery of the seeds from a saved token set, so opening the
 * composer on an existing theme shows where it actually is rather than
 * resetting it to the default.
 */
export function seedsFromTokens(tokens: Record<string, string>): PaletteSeeds {
  return {
    brand: isHex(tokens['brand-600'] ?? '') ? tokens['brand-600'] : '#4f46e5',
    accent: isHex(tokens['accent-500'] ?? '') ? tokens['accent-500'] : '#d97706',
    surface: isHex(tokens['slate-500'] ?? '') ? tokens['slate-500'] : '',
  };
}
