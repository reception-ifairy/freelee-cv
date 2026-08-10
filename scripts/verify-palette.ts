/**
 * The palette engine decides what every branded surface looks like, and the
 * contrast helpers decide whether text is readable. Worth testing as maths.
 * Run with `npx tsx scripts/verify-palette.ts`.
 */
import {
  contrastRatio, hexToRgb, isHex, rampFromSeed, rgbToHex, seedsFromTokens,
  tokensFromSeeds, wcagNonTextVerdict, wcagVerdict, RAMP_STOPS,
} from '@/lib/branding/palette';

const checks: [string, boolean][] = [];
const check = (name: string, actual: unknown, expected: unknown) =>
  checks.push([name, JSON.stringify(actual) === JSON.stringify(expected)]);
const truthy = (name: string, value: boolean) => checks.push([name, value]);

// --- hex parsing ---
check('parses 6-digit hex', hexToRgb('#4f46e5'), { r: 79, g: 70, b: 229 });
check('parses 3-digit hex', hexToRgb('#f0a'), { r: 255, g: 0, b: 170 });
check('rejects nonsense', hexToRgb('not-a-colour'), null);
check('round-trips', rgbToHex(hexToRgb('#4f46e5')!), '#4f46e5');
truthy('isHex accepts a real colour', isHex('#123abc'));
truthy('isHex rejects a word', !isHex('purple'));

// --- ramp ---
const ramp = rampFromSeed('#4f46e5', 'brand');
check('ramp has all ten stops', Object.keys(ramp).length, RAMP_STOPS.length);
truthy('every stop is a valid hex', Object.values(ramp).every(isHex));

// Lightness must decrease monotonically 50 -> 900, or hovers and tints inv+ert.
const luminances = RAMP_STOPS.map((stop) => {
  const { r, g, b } = hexToRgb(ramp[`brand-${stop}`])!;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
});
truthy('ramp gets darker from 50 to 900', luminances.every((v, i) => i === 0 || v < luminances[i - 1]));

// Hue is what carries identity, so it must survive the ramp.
const greenRamp = rampFromSeed('#059669', 'brand');
const g500 = hexToRgb(greenRamp['brand-500'])!;
truthy('a green seed stays green at 500', g500.g > g500.r && g500.g > g500.b);
const g100 = hexToRgb(greenRamp['brand-100'])!;
truthy('a green seed stays green at 100', g100.g >= g100.r && g100.g >= g100.b);

// A grey seed must not produce ten identical greys.
const greyRamp = rampFromSeed('#808080', 'brand');
truthy('a grey seed still ramps', new Set(Object.values(greyRamp)).size === RAMP_STOPS.length);

check('an invalid seed yields nothing', rampFromSeed('nope', 'brand'), {});

// The seed must survive. A fixed lightness table lost it: Emerald Forest's
// #059669 came back as neon mint #08f7ad at brand-600.
// The seed IS the button colour. Two earlier versions failed this: one turned
// #059669 into neon #08f7ad, the other parked it at brand-800.
check('a dark seed is brand-600', greenRamp['brand-600'], '#059669');
check('a mid seed is brand-600', rampFromSeed('#4f46e5', 'brand')['brand-600'], '#4f46e5');
check('a light seed is brand-600', rampFromSeed('#d4c5a0', 'brand')['brand-600'], '#d4c5a0');
check('a very dark seed is brand-600', rampFromSeed('#0b1120', 'brand')['brand-600'], '#0b1120');
check('the accent seed is accent-600', tokensFromSeeds({ brand: '#4f46e5', accent: '#d97706' })['accent-600'], '#d97706');

// --- tokens ---
const tokens = tokensFromSeeds({ brand: '#4f46e5', accent: '#d97706' });
truthy('writes the ten brand stops', RAMP_STOPS.every((s) => `brand-${s}` in tokens));
check('writes only the three accent stops used', Object.keys(tokens).filter((k) => k.startsWith('accent')).sort(), ['accent-400', 'accent-500', 'accent-600']);

// --- contrast ---
truthy('black on white is 21:1', Math.round(contrastRatio('#000000', '#ffffff')) === 21);
truthy('a colour against itself is 1:1', Math.round(contrastRatio('#4f46e5', '#4f46e5')) === 1);
truthy('contrast is symmetric', contrastRatio('#000', '#fff') === contrastRatio('#fff', '#000'));
check('21:1 is AAA', wcagVerdict(21), 'AAA');
check('4.6:1 is AA', wcagVerdict(4.6), 'AA');
check('3.2:1 is large-text only', wcagVerdict(3.2), 'AA Large');
check('2:1 fails', wcagVerdict(2), 'Fail');

// White text on the default primary button must actually be readable.
truthy('white on brand-600 passes AA', contrastRatio('#ffffff', tokens['brand-600']) >= 4.5);

// --- seed recovery ---
check('recovers seeds from tokens', seedsFromTokens({ 'brand-600': '#059669', 'accent-500': '#a7f3d0' }), { brand: '#059669', accent: '#a7f3d0', surface: '' });
check('recovers a surface tint too', seedsFromTokens({ 'slate-500': '#6b7a8f' }).surface, '#6b7a8f');
check('falls back when tokens are empty', seedsFromTokens({}), { brand: '#4f46e5', accent: '#d97706', surface: '' });
check('falls back when tokens are junk', seedsFromTokens({ 'brand-600': 'chartreuse' }), { brand: '#4f46e5', accent: '#d97706', surface: '' });

// Surfaces stay untouched unless a tint is chosen — that is what makes the
// feature safe to add to a site that never had it.
check('no surface tint writes no slate tokens', Object.keys(tokensFromSeeds({ brand: '#4f46e5', accent: '#d97706' })).filter((k) => k.startsWith('slate')).length, 0);
truthy('a surface tint writes the slate scale', Object.keys(tokensFromSeeds({ brand: '#4f46e5', accent: '#d97706', surface: '#6b7a8f' })).filter((k) => k.startsWith('slate')).length === 11);
truthy('a surface tint stays nearly neutral', (() => {
  const t = tokensFromSeeds({ brand: '#4f46e5', accent: '#d97706', surface: '#1e90ff' })['slate-500'];
  const { r, g, b } = hexToRgb(t)!;
  // Even a vivid seed must come out desaturated, or the UI stops reading as grey.
  return Math.max(r, g, b) - Math.min(r, g, b) < 45;
})());

// Non-text content (icons, borders) is judged at 3:1, not 4.5:1 — WCAG 1.4.11.
check('4.5:1 is AAA for non-text', wcagNonTextVerdict(4.6), 'AAA');
check('3.2:1 passes for non-text', wcagNonTextVerdict(3.2), 'AA');
check('2.9:1 fails for non-text', wcagNonTextVerdict(2.9), 'Fail');
// The shipped accent is used for one small icon; it must clear 3:1 on both grounds.
truthy('the default accent clears 3:1 on white', contrastRatio('#d97706', '#ffffff') >= 3);
truthy('the default accent clears 3:1 on dark', contrastRatio('#d97706', '#0a0a0a') >= 3);

let pass = 0;
for (const [name, ok] of checks) {
  if (ok) pass++;
  console.log(ok ? 'ok  ' : 'FAIL', name);
}
console.log(`\n${pass}/${checks.length} passed`);
process.exit(pass === checks.length ? 0 : 1);
