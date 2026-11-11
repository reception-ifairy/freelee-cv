'use client';

import { useRef, useState, useTransition } from 'react';
import { Check, RefreshCw, Server, Stethoscope } from 'lucide-react';
import type { ActionState } from '@/server/actions/auth';
import type { ConnectionFieldView, FetchResult, StoredTest, TestResult } from '@/lib/connections/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Hint, FormMessage } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { TestStatus } from './test-status';

export type ConnectionCardProps = {
  id: string;
  title: string;
  /** One plain sentence: what this is for, and what happens without it. */
  description: string;
  fields: ConnectionFieldView[];
  /** A value is saved here or present in the server's env file — there is something to test. */
  configured: boolean;
  source?: 'saved' | 'env' | 'default' | null;
  /** Stripe, PayPal, S3: no inputs, only which env vars are set (by name). */
  envOnly?: boolean;
  envVars?: { name: string; present: boolean; required: boolean }[];
  note?: string;
  lastTest: StoredTest | null;
  /** "Fetch models", "Fetch voices"… */
  fetchLabel?: string;
  /** Set when a fetched item can be picked as the default (ElevenLabs' voice). */
  chooseLabel?: string;
  chosenId?: string;
  save?: (formData: FormData) => Promise<ActionState>;
  test: () => Promise<TestResult & { at?: string }>;
  fetch?: () => Promise<FetchResult>;
  choose?: (itemId: string) => Promise<ActionState>;
};

/** How many fetched items to list before "and N more" — OpenRouter can add hundreds at once. */
const ITEM_PREVIEW = 12;

/**
 * One outside service, and the only order that makes sense for it:
 * **Save → Test → Fetch.**
 *
 * - **Test** appears once there is something to test (a saved key, or one in
 *   the server's env file) and disappears while an input is being edited — a
 *   test of the old key next to a half-typed new one answers the wrong
 *   question.
 * - **Fetch** appears only after the latest test passed. Pulling a model list
 *   with a key that was just rejected would only fail again, more slowly.
 * - Nothing runs on page load. A test can cost money (AI providers make a tiny
 *   real request), so it only happens when someone presses the button; the
 *   last answer is remembered and shown instead.
 */
export function ConnectionCard({
  id,
  title,
  description,
  fields,
  configured,
  source = null,
  envOnly = false,
  envVars = [],
  note,
  lastTest,
  fetchLabel = 'Fetch',
  chooseLabel,
  chosenId,
  save,
  test,
  fetch,
  choose,
}: ConnectionCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<ActionState>(null);
  const [result, setResult] = useState<StoredTest | null>(lastTest);
  const [fetched, setFetched] = useState<FetchResult | null>(null);
  const [chosen, setChosen] = useState(chosenId);
  const [chooseState, setChooseState] = useState<ActionState>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [fetching, startFetch] = useTransition();
  const [choosing, startChoose] = useTransition();

  // The server owns the remembered answer: a save clears it there, and the
  // page re-renders with `lastTest: null`. Adopt whatever arrives, using the
  // codebase's adjust-state-during-render pattern rather than an effect.
  const [seenTestAt, setSeenTestAt] = useState(lastTest?.at ?? null);
  if ((lastTest?.at ?? null) !== seenTestAt) {
    setSeenTestAt(lastTest?.at ?? null);
    setResult(lastTest);
    if (!lastTest) setFetched(null);
  }
  const [seenChosen, setSeenChosen] = useState(chosenId);
  if (chosenId !== seenChosen) {
    setSeenChosen(chosenId);
    setChosen(chosenId);
  }

  const canTest = configured && !dirty;
  // Hidden while a new test runs, too: the "ok" it would rely on may be about
  // to change.
  const canFetch = Boolean(fetch) && !dirty && !testing && result?.state === 'ok';
  const noun = fields.some((field) => field.type === 'secret') ? 'key' : 'address';

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!save) return;
    const form = event.currentTarget;
    const formData = new FormData(form);

    startSave(async () => {
      const outcome = await save(formData);
      setSaveState(outcome);
      if (!outcome?.success) return;

      // A saved secret is never shown back, so the box returns to "saved —
      // leave blank to keep" instead of holding the key in the page.
      for (const field of fields) {
        const input = form.elements.namedItem(field.key);
        if (field.type === 'secret' && input instanceof HTMLInputElement) input.value = '';
      }
      setDirty(false);
      setResult(null);
      setFetched(null);
    });
  }

  function discard() {
    formRef.current?.reset();
    setDirty(false);
    setSaveState(null);
  }

  function runTest() {
    setSaveState(null);
    setFetched(null);
    setChooseState(null);
    startTest(async () => {
      const outcome = await test();
      setResult({ state: outcome.state, message: outcome.message, at: outcome.at ?? new Date().toISOString() });
    });
  }

  function runFetch() {
    if (!fetch) return;
    setChooseState(null);
    startFetch(async () => setFetched(await fetch()));
  }

  function pick(itemId: string) {
    if (!choose) return;
    setChooseState(null);
    startChoose(async () => {
      const outcome = await choose(itemId);
      setChooseState(outcome);
      if (outcome?.success) setChosen(itemId);
    });
  }

  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      {!envOnly ? (
        <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
          Save
        </Button>
      ) : null}
      {dirty ? (
        <Button type="button" size="sm" variant="ghost" onClick={discard}>
          Undo changes
        </Button>
      ) : null}
      {canTest ? (
        <Button type="button" size="sm" variant="secondary" loading={testing} onClick={runTest}>
          {testing ? null : <Stethoscope />}
          Test
        </Button>
      ) : null}
      {canFetch ? (
        <Button type="button" size="sm" variant="secondary" loading={fetching} onClick={runFetch}>
          {fetching ? null : <RefreshCw />}
          {fetchLabel}
        </Button>
      ) : null}
      <span className="text-xs text-slate-400">
        {dirty
          ? 'Save your change to test it.'
          : !configured
            ? envOnly
              ? "Add the missing values to the server's env file and restart the app, then test here."
              : `Save a ${noun} to test it.`
            : null}
      </span>
    </div>
  );

  return (
    <Card className="min-w-0 p-5" role="region" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <SourceBadge configured={configured} source={source} envOnly={envOnly} noun={noun} />
      </div>

      {envOnly ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs dark:border-slate-700">
            <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <Server className="size-3.5" /> Set on the server
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Kept in the server&apos;s env file on purpose — never typed in or shown here. Change it there and
              restart the app.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {envVars.map((item) => (
                <li key={item.name} className="min-w-0">
                  <Badge
                    tone={item.present ? 'green' : item.required ? 'amber' : 'slate'}
                    className="max-w-full break-all font-mono"
                  >
                    {item.name} · {item.present ? 'set' : item.required ? 'missing' : 'not set'}
                  </Badge>
                </li>
              ))}
            </ul>
            {note ? <p className="mt-2 text-slate-500 dark:text-slate-400">{note}</p> : null}
          </div>
          {buttons}
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={onSubmit}
          onChange={() => {
            setDirty(true);
            setSaveState(null);
          }}
          className="mt-4 space-y-4"
        >
          <div className={cn('grid gap-4', fields.length > 1 && 'sm:grid-cols-2')}>
            {fields.map((field) => (
              <FieldInput key={field.key} cardId={id} field={field} source={source} />
            ))}
          </div>
          {source === 'env' ? (
            <Hint>
              Using the {noun} from the server&apos;s env file (
              {envVars.map((item) => (
                <code key={item.name} className="break-all font-mono">
                  {item.name}
                </code>
              ))}
              ). One saved here takes over from it.
            </Hint>
          ) : null}
          <FormMessage state={saveState} />
          {buttons}
        </form>
      )}

      <div className="mt-4 space-y-3 empty:hidden">
        {result ? (
          <TestStatus state={result.state} message={result.message} at={result.at} className={cn(dirty && 'opacity-60')} />
        ) : canTest ? (
          <p className="text-xs text-slate-400">Not tested yet.</p>
        ) : null}

        {fetched && !dirty ? (
          <FetchedPanel
            result={fetched}
            chooseLabel={choose ? chooseLabel : undefined}
            chosen={chosen}
            choosing={choosing}
            onPick={pick}
            chooseState={chooseState}
          />
        ) : null}
      </div>
    </Card>
  );
}

function SourceBadge({
  configured,
  source,
  envOnly,
  noun,
}: {
  configured: boolean;
  source: ConnectionCardProps['source'];
  envOnly: boolean;
  noun: string;
}) {
  if (envOnly) return configured ? <Badge tone="green">Set on the server</Badge> : <Badge tone="amber">Not set</Badge>;
  if (source === 'saved') return <Badge tone="green">{noun === 'key' ? 'Key saved' : 'Address saved'}</Badge>;
  if (source === 'env') return <Badge tone="green">{noun === 'key' ? 'Key from server file' : 'Address from server file'}</Badge>;
  if (source === 'default') return <Badge tone="slate">Default address</Badge>;
  return <Badge tone="amber">No {noun}</Badge>;
}

function FieldInput({
  cardId,
  field,
  source,
}: {
  cardId: string;
  field: ConnectionFieldView;
  source: ConnectionCardProps['source'];
}) {
  const inputId = `${cardId}-${field.key}`;

  return (
    <div className="min-w-0">
      <Label htmlFor={inputId}>{field.label}</Label>
      {field.type === 'secret' ? (
        <Input
          id={inputId}
          name={field.key}
          type="password"
          // "new-password" is the value browsers actually respect: without it
          // a saved login password gets autofilled into an API key box.
          autoComplete="new-password"
          spellCheck={false}
          className="font-mono"
          placeholder={
            field.saved
              ? '•••••••• saved — leave blank to keep'
              : source === 'env'
                ? 'Paste a key to use instead of the server one'
                : 'Paste the key'
          }
        />
      ) : (
        <Input
          id={inputId}
          name={field.key}
          defaultValue={field.value ?? ''}
          placeholder={field.placeholder}
          spellCheck={false}
          className={field.format === 'url' ? 'font-mono' : undefined}
        />
      )}
      {field.hint ? <Hint>{field.hint}</Hint> : null}
    </div>
  );
}

function FetchedPanel({
  result,
  chooseLabel,
  chosen,
  choosing,
  onPick,
  chooseState,
}: {
  result: FetchResult;
  chooseLabel?: string;
  chosen?: string;
  choosing: boolean;
  onPick: (id: string) => void;
  chooseState: ActionState;
}) {
  const items = result.items ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-white/10">
      <p
        role="status"
        className={result.ok ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}
      >
        {result.summary}
      </p>

      {chooseLabel && items.length > 0 ? (
        <div className="space-y-2">
          <p className="font-semibold text-slate-600 dark:text-slate-300">{chooseLabel} — pick one</p>
          <FormMessage state={chooseState} />
          <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={choosing}
                onClick={() => onPick(item.id)}
                className={cn(
                  'flex min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-60',
                  item.id === chosen
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20',
                )}
              >
                <span className="min-w-0 truncate font-medium">{item.label}</span>
                {item.id === chosen ? (
                  <span className="flex shrink-0 items-center gap-1 text-brand-700 dark:text-brand-300">
                    <Check className="size-3.5" /> In use
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.slice(0, ITEM_PREVIEW).map((item) => (
            <li key={item.id} className="min-w-0 max-w-full">
              <Badge tone="slate" className="max-w-full break-all font-mono">
                {item.label}
              </Badge>
            </li>
          ))}
          {items.length > ITEM_PREVIEW ? (
            <li className="self-center text-slate-500 dark:text-slate-400">and {items.length - ITEM_PREVIEW} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
