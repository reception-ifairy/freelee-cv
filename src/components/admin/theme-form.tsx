'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateThemeAction } from '@/server/actions/admin-branding';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';
import { CardRadioGroup } from '@/components/ui/card-radio-group';
import { FONT_KEYS, FONT_LABELS, fontStack } from '@/lib/branding/fonts';
import { ThemeComposer } from './theme-composer';
import { seedsFromTokens, type PaletteSeeds } from '@/lib/branding/palette';
import type { Theme } from '@/db/schema';

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

export function ThemeForm({ theme }: { theme: Theme }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateThemeAction, null);
  // Seeds drive the whole palette; overrides are the individual shades an admin
  // has set by hand and which must survive a seed change.
  const [seeds, setSeeds] = useState<PaletteSeeds>(seedsFromTokens(theme.tokens));
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [headingFont, setHeadingFont] = useState(theme.headingFont ?? '');
  const [bodyFont, setBodyFont] = useState(theme.bodyFont ?? '');

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={theme.id} />
      <FormMessage state={state} />

      <div>
        <Label htmlFor={`name-${theme.id}`}>Theme name</Label>
        <Input id={`name-${theme.id}`} name="name" defaultValue={theme.name} required />
      </div>

      <ThemeComposer
        seeds={seeds}
        overrides={overrides}
        onSeeds={setSeeds}
        onOverride={(key, value) => setOverrides((prev) => ({ ...prev, [key]: value }))}
        onResetOverrides={() => setOverrides({})}
      />

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
        <div className="sm:col-span-2">
          <Label>Heading font</Label>
          <CardRadioGroup
            name="headingFont"
            columns={3}
            value={headingFont}
            onChange={setHeadingFont}
            items={[
              { id: '', label: 'Same as body' },
              ...FONT_KEYS.map((k) => ({ id: k, label: FONT_LABELS[k], style: { fontFamily: fontStack(k) ?? undefined } })),
            ]}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Body font</Label>
          <CardRadioGroup
            name="bodyFont"
            columns={3}
            value={bodyFont}
            onChange={setBodyFont}
            items={[
              { id: '', label: 'Default (Inter)' },
              ...FONT_KEYS.map((k) => ({ id: k, label: FONT_LABELS[k], style: { fontFamily: fontStack(k) ?? undefined } })),
            ]}
          />
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

      <SaveButton />
    </form>
  );
}
