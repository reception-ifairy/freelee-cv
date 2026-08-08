'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateThemeAction } from '@/server/actions/admin-branding';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, Select, FormMessage } from '@/components/ui/field';
import { FONT_KEYS, FONT_LABELS } from '@/lib/branding/fonts';
import type { Theme } from '@/db/schema';

/** Keys match the CSS custom properties emitted by the root layout (src/app/layout.tsx). */
export const DEFAULT_TOKENS: Record<string, string> = {
  'brand-50': '#eef2ff', 'brand-100': '#e0e7ff', 'brand-200': '#c7d2fe', 'brand-300': '#a5b4fc',
  'brand-400': '#818cf8', 'brand-500': '#6366f1', 'brand-600': '#4f46e5', 'brand-700': '#4338ca',
  'brand-800': '#3730a3', 'brand-900': '#312e81',
  'accent-400': '#fbbf24', 'accent-500': '#f59e0b', 'accent-600': '#d97706',
};

const PRIMARY_KEYS = ['brand-500', 'brand-600', 'accent-500'] as const;

const LABELS: Record<string, string> = {
  'brand-500': 'Primary', 'brand-600': 'Primary (hover)', 'accent-500': 'Accent',
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save theme'}
    </button>
  );
}

function ColorField({
  fieldKey, value, onChange,
}: {
  fieldKey: string;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={`token-${fieldKey}`}>{LABELS[fieldKey] ?? fieldKey}</Label>
      <div className="flex gap-2">
        <input
          id={`token-${fieldKey}`}
          type="color"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="h-10 w-14 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700"
        />
        <Input
          name={`token.${fieldKey}`}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ThemeForm({ theme }: { theme: Theme }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateThemeAction, null);
  const [tokens, setTokens] = useState<Record<string, string>>({ ...DEFAULT_TOKENS, ...theme.tokens });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const setToken = (key: string, value: string) => setTokens((prev) => ({ ...prev, [key]: value }));
  const advancedKeys = Object.keys(DEFAULT_TOKENS).filter((k) => !(PRIMARY_KEYS as readonly string[]).includes(k));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={theme.id} />
      <FormMessage state={state} />

      <div>
        <Label htmlFor={`name-${theme.id}`}>Theme name</Label>
        <Input id={`name-${theme.id}`} name="name" defaultValue={theme.name} required />
      </div>

      <div>
        <h3 className="text-sm font-semibold">Primary palette</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          {PRIMARY_KEYS.map((key) => (
            <ColorField key={key} fieldKey={key} value={tokens[key] ?? DEFAULT_TOKENS[key]} onChange={setToken} />
          ))}
        </div>
      </div>

      <details open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          Advanced palette ({advancedKeys.length} more tokens)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {advancedKeys.map((key) => (
            <ColorField key={key} fieldKey={key} value={tokens[key] ?? DEFAULT_TOKENS[key]} onChange={setToken} />
          ))}
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`logoUrl-${theme.id}`}>Logo URL</Label>
          <Input id={`logoUrl-${theme.id}`} name="logoUrl" defaultValue={theme.logoUrl ?? ''} placeholder="https://…" />
          <Hint>Leave blank to use the built-in mark.</Hint>
        </div>
        <div>
          <Label htmlFor={`faviconUrl-${theme.id}`}>Favicon URL</Label>
          <Input id={`faviconUrl-${theme.id}`} name="faviconUrl" defaultValue={theme.faviconUrl ?? ''} placeholder="https://…/favicon.ico" />
        </div>
        <div>
          <Label htmlFor={`headingFont-${theme.id}`}>Heading font</Label>
          <Select id={`headingFont-${theme.id}`} name="headingFont" defaultValue={theme.headingFont ?? ''}>
            <option value="">Same as body</option>
            {FONT_KEYS.map((k) => (
              <option key={k} value={k}>{FONT_LABELS[k]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`bodyFont-${theme.id}`}>Body font</Label>
          <Select id={`bodyFont-${theme.id}`} name="bodyFont" defaultValue={theme.bodyFont ?? ''}>
            <option value="">Default (Inter)</option>
            {FONT_KEYS.map((k) => (
              <option key={k} value={k}>{FONT_LABELS[k]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`customCss-${theme.id}`}>Custom CSS</Label>
        <textarea
          id={`customCss-${theme.id}`}
          name="customCss"
          rows={6}
          defaultValue={theme.customCss ?? ''}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
          placeholder=".hero { letter-spacing: -0.02em; }"
        />
        <Hint>Injected into every page when this theme is active. Use sparingly.</Hint>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Live preview</p>
        <div className="space-y-3">
          <p className="text-lg font-bold">Heading text</p>
          <p className="text-sm text-slate-500">Body copy in the muted colour.</p>
          <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: tokens['brand-500'] }}>
            Primary button
          </button>
          <button type="button" className="ml-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: tokens['accent-500'] }}>
            Accent button
          </button>
        </div>
      </div>

      <SaveButton />
    </form>
  );
}
