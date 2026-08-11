'use client';

import { useState, useTransition } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { LEAD_TOOLS, type LeadTool } from '@/lib/leads/catalog';
import { captureLeadAction } from '@/server/actions/leads';
import { BlockIcon } from '@/components/ui/block-icon';
import { cn } from '@/lib/utils';

/**
 * The assistant's conversational tools, adapted from BotVerse's hub.
 *
 * The idea worth taking: the moment somebody is interested is the moment to
 * ask. A grid of small actions inside the chat — claim a trial, request a
 * callback — captures that far better than a contact page three clicks away.
 *
 * Each tool opens a short form **in place**. Only one is open at a time: a
 * panel this size showing five forms at once is a wall, not an offer.
 */
export function AssistantTools({ chatId, accentColor }: { chatId: string | null; accentColor: string }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick actions</p>

      <div className="grid grid-cols-2 gap-1.5">
        {LEAD_TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            onClick={() => setOpen(open === tool.kind ? null : tool.kind)}
            aria-expanded={open === tool.kind}
            className={cn(
              'flex items-start gap-2 rounded-xl border p-2 text-left transition',
              open === tool.kind
                ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10'
                : 'border-slate-200 hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-500/50',
            )}
          >
            <span
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: accentColor }}
            >
              <BlockIcon name={tool.icon} className="size-3" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold leading-tight">{tool.label}</span>
              <span className="block truncate text-[10px] text-slate-400">{tool.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      {open ? <ToolForm key={open} tool={LEAD_TOOLS.find((t) => t.kind === open)!} chatId={chatId} onDone={() => setOpen(null)} /> : null}
    </div>
  );
}

function ToolForm({ tool, chatId, onDone }: { tool: LeadTool; chatId: string | null; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set('kind', tool.kind);
    if (chatId) formData.set('chatId', chatId);
    for (const [key, value] of Object.entries(values)) formData.set(key, value);

    startTransition(async () => {
      const result = await captureLeadAction(null, formData);
      if (result?.success) {
        setMessage({ ok: true, text: result.success });
        // Left on screen for a moment so the confirmation is actually read.
        setTimeout(onDone, 2600);
      } else {
        setMessage({ ok: false, text: result?.error ?? 'That did not send.' });
      }
    });
  }

  if (message?.ok) {
    return (
      <p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CircleCheck className="mt-px size-3.5 shrink-0" />
        {message.text}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
      {tool.fields.map((field) =>
        field.type === 'textarea' ? (
          <textarea
            key={field.key}
            required={field.required}
            value={values[field.key] ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.label}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        ) : (
          <input
            key={field.key}
            type={field.type}
            required={field.required}
            value={values[field.key] ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.label}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        ),
      )}

      {message && !message.ok ? (
        <p role="status" className="text-[11px] text-rose-600 dark:text-rose-400">{message.text}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-xs font-bold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {tool.cta}
      </button>

      <p className="text-[10px] leading-snug text-slate-400">
        We use this only to reply to you.
      </p>
    </form>
  );
}
