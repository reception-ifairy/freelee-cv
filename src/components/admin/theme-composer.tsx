'use client';

import { Check, RotateCcw } from 'lucide-react';
import {
  PALETTE_PRESETS, RAMP_STOPS, SURFACE_STOPS, contrastRatio, isHex, tokensFromSeeds, wcagNonTextVerdict, wcagVerdict,
  type PaletteSeeds, type ContrastVerdict,
} from '@/lib/branding/palette';
import { Label } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { cn } from '@/lib/utils';

/**
 * The palette half of the theme editor.
 *
 * Before this, the form exposed three colour boxes (`brand-500`, `brand-600`,
 * `accent-500`) out of thirteen tokens. Changing the brand to green left the
 * other seven brand stops indigo, so tints, hovers and dark-mode surfaces
 * disagreed with the colour that had just been picked. Here one seed generates
 * the whole ramp, so a chosen colour actually takes.
 *
 * Presets are starting points, not a cage: picking one fills the seeds, and
 * every stop can still be overridden by hand.
 */
/** A few honest options rather than a colour wheel — surfaces should be nearly neutral. */
const SURFACE_TINTS = [
  { hex: '#8f8378', label: 'Warm paper' },
  { hex: '#6b7a8f', label: 'Cool slate' },
  { hex: '#7a7a7a', label: 'True grey' },
  { hex: '#6b7f75', label: 'Sage' },
] as const;

export function ThemeComposer({
  seeds,
  overrides,
  onSeeds,
  onOverride,
  onResetOverrides,
}: {
  seeds: PaletteSeeds;
  overrides: Record<string, string>;
  onSeeds: (next: PaletteSeeds) => void;
  onOverride: (key: string, value: string) => void;
  onResetOverrides: () => void;
}) {
  const generated = tokensFromSeeds(seeds);
  const tokens = { ...generated, ...overrides };
  const overriddenCount = Object.keys(overrides).length;

  const activePreset = PALETTE_PRESETS.find(
    (preset) =>
      preset.seeds.brand.toLowerCase() === seeds.brand.toLowerCase() &&
      preset.seeds.accent.toLowerCase() === seeds.accent.toLowerCase(),
  );

  return (
    <div className="space-y-5">
      {/* Hidden inputs are what the server action actually reads (`token.<key>`),
          so every generated stop is saved, not only the ones with a visible
          control. */}
      {Object.entries(tokens).map(([key, value]) => (
        <input key={key} type="hidden" name={`token.${key}`} value={value} />
      ))}

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">Start from a palette</h3>
          <HelpTip
            title="Palettes"
            body="Each one sets a main colour and an accent. Everything else — hovers, tints, dark-mode surfaces — is worked out from those two, so the whole site stays consistent. You can change either colour afterwards."
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {PALETTE_PRESETS.map((preset) => {
            const swatches = tokensFromSeeds(preset.seeds);
            const selected = activePreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSeeds(preset.seeds)}
                aria-pressed={selected}
                className={cn(
                  'rounded-xl border p-3 text-left transition',
                  selected
                    ? 'border-brand-500 ring-2 ring-brand-500/25'
                    : 'border-slate-200 hover:border-brand-400 dark:border-slate-700',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="flex flex-1 overflow-hidden rounded-md">
                    {[200, 400, 600, 800].map((stop) => (
                      <span key={stop} className="h-5 flex-1" style={{ background: swatches[`brand-${stop}`] }} />
                    ))}
                    <span className="h-5 flex-1" style={{ background: swatches['accent-500'] }} />
                  </span>
                  {selected ? <Check className="size-4 shrink-0 text-brand-600" /> : null}
                </span>
                <span className="mt-2 block text-xs font-semibold">{preset.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <SeedField
          label="Main colour"
          help="Buttons, links and anything that should read as your brand."
          value={seeds.brand}
          onChange={(brand) => onSeeds({ ...seeds, brand })}
        />
        <SeedField
          label="Accent colour"
          help="Used sparingly — highlights, badges and the occasional emphasis."
          value={seeds.accent}
          onChange={(accent) => onSeeds({ ...seeds, accent })}
        />
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Label className="mb-0">Surface tint</Label>
          <HelpTip
            title="Surface tint"
            body="Nudges every grey — page background, cards, borders, body text — towards one hue. A few percent is the whole effect: warm paper, cool slate, true black. Leave it off and the greys stay exactly as shipped."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSeeds({ ...seeds, surface: '' })}
            aria-pressed={!seeds.surface}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-semibold transition',
              !seeds.surface ? 'border-brand-500 ring-2 ring-brand-500/25' : 'border-slate-200 dark:border-slate-700',
            )}
          >
            Neutral (default)
          </button>
          {SURFACE_TINTS.map((tint) => (
            <button
              key={tint.hex}
              type="button"
              onClick={() => onSeeds({ ...seeds, surface: tint.hex })}
              aria-pressed={seeds.surface?.toLowerCase() === tint.hex}
              title={tint.label}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition',
                seeds.surface?.toLowerCase() === tint.hex
                  ? 'border-brand-500 ring-2 ring-brand-500/25'
                  : 'border-slate-200 hover:border-brand-400 dark:border-slate-700',
              )}
            >
              <span className="size-4 rounded-full border border-black/10" style={{ background: tint.hex }} />
              {tint.label}
            </button>
          ))}
        </div>
        {seeds.surface ? (
          <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {SURFACE_STOPS.map((stop) => (
              <span key={stop} className="h-6 flex-1" title={`slate-${stop}`} style={{ background: tokens[`slate-${stop}`] }} />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Label className="mb-0">The full scale</Label>
          {overriddenCount > 0 ? (
            <button
              type="button"
              onClick={onResetOverrides}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              <RotateCcw className="size-3" /> Reset {overriddenCount} edited {overriddenCount === 1 ? 'shade' : 'shades'}
            </button>
          ) : null}
        </div>

        <div className="flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          {RAMP_STOPS.map((stop) => {
            const key = `brand-${stop}`;
            const edited = key in overrides;
            return (
              <label
                key={stop}
                className="group relative flex-1 cursor-pointer"
                title={`${key} — ${tokens[key]}${edited ? ' (edited)' : ''}`}
              >
                <span className="block h-14" style={{ background: tokens[key] }} />
                <span className="block bg-white py-1 text-center text-[10px] font-medium text-slate-500 dark:bg-slate-900">
                  {stop}
                  {edited ? <span className="ml-0.5 text-brand-500">•</span> : null}
                </span>
                <input
                  type="color"
                  value={tokens[key]}
                  onChange={(event) => onOverride(key, event.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label={`Override ${key}`}
                />
              </label>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Worked out from the main colour. Click any shade to set it by hand.
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <Label className="mb-0">Readability</Label>
          <HelpTip
            title="Readability"
            body="Contrast against the WCAG standard. AA is the level to aim for on normal text — below it, text becomes hard to read for anyone with less than perfect sight, and that is the group least able to work around it."
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ContrastCard label="Button text" foreground="#ffffff" background={tokens['brand-600']} />
          <ContrastCard label="Link on white" foreground={tokens['brand-600']} background="#ffffff" />
          <ContrastCard label="Link in dark mode" foreground={tokens['brand-400']} background="#0a0a0a" />
          {/* The accent is only ever an icon here, so it is judged against the
              3:1 non-text bar rather than the 4.5:1 body-text one. */}
          <ContrastCard label="Accent icon on white" foreground={tokens['accent-600']} background="#ffffff" nonText />
        </div>
      </section>

      <Preview tokens={tokens} />
    </div>
  );
}

function SeedField({
  label, help, value, onChange,
}: {
  label: string; help: string; value: string; onChange: (value: string) => void;
}) {
  const valid = isHex(value);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Label className="mb-0">{label}</Label>
        <HelpTip title={label} body={help} />
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className={cn(
            'h-10 w-full rounded-xl border bg-white px-3 font-mono text-xs shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900',
            valid
              ? 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700'
              : 'border-rose-400 focus:ring-rose-400/30',
          )}
        />
      </div>
      {!valid ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">That is not a colour — use a hex value like #4f46e5.</p> : null}
    </div>
  );
}

const VERDICT_TONE: Record<ContrastVerdict, string> = {
  AAA: 'text-emerald-600 dark:text-emerald-400',
  AA: 'text-emerald-600 dark:text-emerald-400',
  'AA Large': 'text-amber-600 dark:text-amber-400',
  Fail: 'text-rose-600 dark:text-rose-400',
};

function ContrastCard({
  label, foreground, background, nonText,
}: {
  label: string; foreground: string; background: string; nonText?: boolean;
}) {
  const ratio = contrastRatio(foreground, background);
  const verdict = nonText ? wcagNonTextVerdict(ratio) : wcagVerdict(ratio);

  return (
    <div className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
      <div className="mb-2 grid h-10 place-items-center rounded-lg text-sm font-semibold" style={{ background, color: foreground }}>
        Aa
      </div>
      <p className="truncate text-[11px] text-slate-400">{label}</p>
      <p className={cn('text-xs font-bold', VERDICT_TONE[verdict])}>
        {verdict} · {ratio.toFixed(1)}:1
      </p>
    </div>
  );
}

/** A miniature of the real thing — a heading, body copy, two buttons, a badge and a link. */
function Preview({ tokens }: { tokens: Record<string, string> }) {
  return (
    <section>
      <Label>Preview</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewCard tokens={tokens} mode="light" />
        <PreviewCard tokens={tokens} mode="dark" />
      </div>
    </section>
  );
}

function PreviewCard({ tokens, mode }: { tokens: Record<string, string>; mode: 'light' | 'dark' }) {
  const dark = mode === 'dark';
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: dark ? '#0a0a0a' : '#ffffff',
        borderColor: dark ? '#27272a' : '#e2e8f0',
        color: dark ? '#e2e8f0' : '#0f172a',
      }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
        {mode}
      </p>
      <p className="text-base font-bold tracking-tight">Your AI agency, staffed by personas</p>
      <p className="mt-1 text-xs" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
        Body copy sits underneath, in the quieter colour.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white" style={{ background: tokens['brand-600'] }}>
          Primary
        </span>
        <span
          className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: dark ? '#3f3f46' : '#e2e8f0', color: dark ? '#e2e8f0' : '#0f172a' }}
        >
          Secondary
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: dark ? tokens['brand-900'] : tokens['brand-50'],
            color: dark ? tokens['brand-300'] : tokens['brand-700'],
          }}
        >
          Badge
        </span>
        <span className="text-xs font-semibold" style={{ color: dark ? tokens['brand-400'] : tokens['brand-600'] }}>
          A link
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: tokens['accent-500'] }}>
          Accent
        </span>
      </div>
    </div>
  );
}
