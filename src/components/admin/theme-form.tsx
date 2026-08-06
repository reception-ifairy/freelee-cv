'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveThemeAction } from '@/server/actions/admin';
import type { ActionState } from '@/server/actions/auth';
import { Card } from '@/components/ui/card';
import { Input, Textarea, Label, Hint, FormMessage } from '@/components/ui/field';

/** Keys match the CSS custom properties emitted by the root layout. */
export const DEFAULT_TOKENS: Record<string, string> = {
  'brand-500': '#6366f1',
  'brand-600': '#4f46e5',
  'accent-500': '#f59e0b',
};

const LABELS: Record<string, string> = {
  'brand-500': 'Primary',
  'brand-600': 'Primary (hover)',
  'accent-500': 'Accent',
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save appearance'}
    </button>
  );
}

export function ThemeForm({
  tokens: initialTokens,
  customCss,
}: {
  tokens: Record<string, string>;
  customCss: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveThemeAction, null);
  const [tokens, setTokens] = useState(initialTokens);

  return (
    <form action={formAction}>
      <FormMessage state={state} />

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <h2 className="font-semibold">Design tokens</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(DEFAULT_TOKENS).map((key) => (
              <div key={key}>
                <Label htmlFor={`token-${key}`}>{LABELS[key] ?? key}</Label>
                <div className="flex gap-2">
                  <input
                    id={`token-${key}`}
                    type="color"
                    value={tokens[key] ?? DEFAULT_TOKENS[key]}
                    onChange={(e) => setTokens({ ...tokens, [key]: e.target.value })}
                    className="h-10 w-14 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                  <Input
                    name={`token.${key}`}
                    value={tokens[key] ?? DEFAULT_TOKENS[key]}
                    onChange={(e) => setTokens({ ...tokens, [key]: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="customCss">Custom CSS</Label>
            <Textarea
              id="customCss"
              name="customCss"
              rows={8}
              defaultValue={customCss}
              className="font-mono text-xs"
              placeholder=".hero { letter-spacing: -0.02em; }"
            />
            <Hint>Injected into every page. Use sparingly.</Hint>
          </div>

          <SaveButton />
        </Card>

        <Card className="h-fit p-6">
          <h2 className="font-semibold">Live preview</h2>
          <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-lg font-bold">Heading text</p>
            <p className="text-sm text-slate-500">Body copy in the muted colour.</p>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: tokens['brand-500'] }}
            >
              Primary button
            </button>
            <button
              type="button"
              className="ml-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: tokens['accent-500'] }}
            >
              Accent button
            </button>
          </div>
        </Card>
      </div>
    </form>
  );
}
