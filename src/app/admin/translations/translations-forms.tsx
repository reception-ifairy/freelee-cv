'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addLocaleAction, retryLocaleAction, importTranslationsAction } from '@/server/actions/admin-translations';
import type { ActionState } from '@/server/actions/auth';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * The "intelligent AI menu" — one plain-language input, no dropdown of ISO
 * codes to know in advance. Submitting inserts the locale `pending`
 * ("frozen" in the locales list below) immediately, then runs the whole
 * translation pipeline in the same request — the button stays in its
 * pending state (via useFormStatus) for the few seconds that takes.
 */
export function AddLanguageForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(addLocaleAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="languageName">Language</Label>
        <Input id="languageName" name="languageName" placeholder="German" required />
        <Hint>Just the name — the AI works out the language code and translates every known string into it.</Hint>
      </div>
      <SubmitButton label="Add & translate with AI" pendingLabel="Translating…" />
    </form>
  );
}

export function RetryButton({ code }: { code: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(retryLocaleAction, null);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="code" value={code} />
      {state?.error ? <span className="text-xs text-rose-500">{state.error}</span> : null}
      <RetrySubmitButton />
    </form>
  );
}

function RetrySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {pending ? 'Retrying…' : 'Retry'}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(importTranslationsAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="file">Translations file</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/json"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:hover:file:bg-slate-700"
        />
        <Hint>From "Export" below, or a coworker's reviewed copy of one (docs/17-translations.md).</Hint>
      </div>
      <SubmitButton label="Import" pendingLabel="Importing…" />
    </form>
  );
}
