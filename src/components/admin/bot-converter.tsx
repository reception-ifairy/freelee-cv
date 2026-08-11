'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, Check, Code, Eye, FileSpreadsheet, FileText, FileUp, Loader2, Sparkles,
} from 'lucide-react';
import { convertDocumentAction, importConvertedPersonaAction } from '@/server/actions/admin-persona-convert';
import type { ConversionState } from '@/server/actions/admin-persona-convert';
import { Input, Textarea, Label, Hint } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * The bot converter's front end: drop a document in, read what came out, import it.
 *
 * The **review step is the point**, not a formality — so the result is shown as
 * a readable card first and the raw blueprint JSON second, rather than dumping
 * JSON and calling it a preview. Nobody proof-reads a wall of braces, and this
 * persona is going to talk to customers.
 */

const ACCEPT = '.txt,.md,.json,.csv,.pdf,.docx,.xlsx';
const MAX_MB = 8;

/** Rotated while the (slow, single) request is in flight — an 8 MB PDF against a large model takes a while. */
const STEPS = [
  'Reading the document…',
  'Extracting the character…',
  'Writing the system prompt…',
  'Scoring personality traits…',
];

function FileGlyph({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.xlsx')) return <FileSpreadsheet className="size-7 text-emerald-400" />;
  const tag = lower.endsWith('.json') ? 'JSON' : lower.endsWith('.pdf') ? 'PDF' : lower.endsWith('.md') ? 'MD' : null;
  if (tag) return <span className="font-mono text-xs font-bold text-brand-400">{tag}</span>;
  return <FileText className="size-7 text-brand-400" />;
}

function ConvertButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const [step, setStep] = useState(0);

  // Cycles the label while pending. A single frozen "Converting…" for 30+
  // seconds reads as a hang, and this request genuinely cannot be streamed —
  // it returns one JSON object or nothing. The timer only runs while pending,
  // so an idle form isn't ticking in the background.
  useEffect(() => {
    if (!pending) {
      setStep(0);
      return;
    }
    const timer = setInterval(() => setStep((s) => s + 1), 6000);
    return () => clearInterval(timer);
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {pending ? STEPS[step % STEPS.length] : 'Run the conversion'}
    </button>
  );
}

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      {pending ? 'Creating…' : 'Create and open in the editor'}
      {pending ? null : <ArrowRight className="size-4" />}
    </button>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export function BotConverter() {
  const [state, formAction] = useActionState<ConversionState, FormData>(convertDocumentAction, null);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const result = state && 'persona' in state ? state : null;
  const error = localError ?? (state && 'error' in state ? state.error : null);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    if (candidate.size > MAX_MB * 1024 * 1024) {
      setLocalError(`That file is ${(candidate.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
      return;
    }
    setLocalError(null);
    setFile(candidate);
  }

  if (result) {
    const { persona } = result;
    const traits = Object.entries(persona.personality).filter(([, v]) => typeof v === 'number') as [string, number][];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Draft ready.</span>{' '}
            <span className="text-slate-500 dark:text-slate-400">
              Extracted from {result.source} by {result.provider} ({result.model}). Nothing is saved yet.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-white/10"
          >
            {showJson ? <Eye className="size-3.5" /> : <Code className="size-3.5" />}
            {showJson ? 'Show the summary' : 'Show the raw blueprint'}
          </button>
        </div>

        {showJson ? (
          <pre className="max-h-[36rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-5 font-mono text-[11px] leading-relaxed text-brand-300 dark:border-white/10">
            {JSON.stringify(persona, null, 2)}
          </pre>
        ) : (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <div>
              <h2 className="text-lg font-bold tracking-tight">{persona.name}</h2>
              {persona.tagline ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{persona.tagline}</p> : null}
            </div>

            {persona.description ? <p className="text-sm leading-relaxed">{persona.description}</p> : null}

            <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 dark:border-white/10">
              <Field label="Expertise" value={persona.expertise} />
              <Field label="Audience" value={persona.audienceType} />
              <Field label="Interaction style" value={persona.interactionStyle} />
              <Field label="When unsure" value={persona.approachToUnknown} />
            </div>

            {persona.knowledgeDomains.length > 0 ? (
              <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">Knowledge domains</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {persona.knowledgeDomains.map((d) => (
                    <span key={d} className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs dark:border-white/10">{d}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {traits.length > 0 ? (
              <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">Personality</p>
                <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {traits.map(([name, value]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs capitalize text-slate-500 dark:text-slate-400">{name}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${value}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-slate-500">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-200 pt-5 dark:border-white/10">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">System prompt</p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed dark:bg-white/[0.04]">
                {persona.systemPrompt}
              </p>
            </div>

            {persona.welcomeMessage ? (
              <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">Opening line</p>
                <p className="mt-2 text-sm">{persona.welcomeMessage}</p>
                {persona.suggestions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {persona.suggestions.map((s) => (
                      <span key={s} className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-white/10">{s}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            It will be created <strong>hidden</strong> — read it through, then publish it from the editor.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/personas/convert"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-white/10"
            >
              Convert another
            </Link>
            <form action={importConvertedPersonaAction}>
              <input type="hidden" name="persona" value={JSON.stringify(persona)} />
              <ImportButton />
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <input type="hidden" name="mode" value={mode} />

      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex border-b border-slate-200 dark:border-white/10">
            {(['upload', 'paste'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={cn(
                  'flex-1 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition',
                  mode === tab
                    ? 'border-b-2 border-brand-500 text-brand-400'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {tab === 'upload' ? 'Upload a file' : 'Paste a description'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {mode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  accept(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInput.current?.click()}
                className={cn(
                  'flex min-h-[15rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition',
                  dragging
                    ? 'border-brand-500 bg-brand-500/5'
                    : 'border-slate-300 hover:border-slate-400 dark:border-white/15 dark:hover:border-white/25',
                )}
              >
                <input
                  ref={fileInput}
                  type="file"
                  name="file"
                  accept={ACCEPT}
                  onChange={(e) => accept(e.target.files?.[0])}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                    <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-brand-500/25 bg-brand-500/10">
                      <FileGlyph name={file.name} />
                    </span>
                    <div>
                      <p className="truncate text-sm font-semibold">{file.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB — ready</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInput.current) fileInput.current.value = '';
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-rose-500 dark:border-white/10"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-slate-200 text-slate-400 dark:border-white/10">
                      <FileUp className="size-6" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Drop a file here, or click to browse</p>
                      <p className="mt-1 text-xs text-slate-500">
                        PDF, Word (.docx), Excel (.xlsx), JSON, Markdown, CSV or plain text — up to {MAX_MB} MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name it (optional)</Label>
                  <Input id="name" name="name" placeholder="e.g. Front-desk assistant" />
                  <Hint>Only a label for the conversion — the extracted name wins if the text gives one.</Hint>
                </div>
                <div>
                  <Label htmlFor="text">Character description, transcript or brief</Label>
                  <Textarea id="text" name="text" rows={12} value={pasted} onChange={(e) => setPasted(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-semibold text-rose-500">That didn&rsquo;t convert</p>
              <p className="mt-1 text-xs text-rose-400/90">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <Label htmlFor="hint">Anything to add?</Label>
            <Textarea id="hint" name="hint" rows={4} placeholder="e.g. This is our old Intercom bot — keep the tone but make it warmer." />
            <Hint>Optional. Steers the extraction where the document is thin or ambiguous.</Hint>
          </div>

          <ConvertButton disabled={mode === 'upload' ? !file : pasted.trim().length < 40} />

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Runs on the platform&rsquo;s default chat model and costs a real API call. The result is a
            draft you review before anything is saved.
          </p>
        </div>
      </div>
    </form>
  );
}
