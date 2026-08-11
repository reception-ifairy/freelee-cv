'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageIcon, X } from 'lucide-react';
import { generateImageAction, type ImageActionState, type GeneratedMessage } from '@/server/actions/images';
import { Input, FormMessage } from '@/components/ui/field';

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create'}
    </button>
  );
}

/**
 * "Create an image" — a separate panel rather than a mode of the message box,
 * because it behaves differently in every way that matters: one slow request
 * instead of a stream, billed per picture instead of per token, and it takes
 * a description rather than a conversational turn.
 *
 * Only rendered when the persona has the `images` capability; the action
 * re-checks that server-side regardless.
 */
export function ImageGenerator({
  chatId,
  onGenerated,
}: {
  chatId: string;
  /** Hands the newly created messages to the transcript that owns them. */
  onGenerated: (created: GeneratedMessage[]) => void;
}) {
  const [state, formAction] = useActionState<ImageActionState, FormData>(generateImageAction, null);
  const [open, setOpen] = useState(false);
  const appliedRef = useRef<string | null>(null);

  // The action returns the messages it wrote, and they're appended straight to
  // the live transcript. This used to reload the whole page — the component
  // sat outside ChatWindow and so had no way to reach `useChat`'s state.
  //
  // Guarded by the last applied message id because `useActionState` keeps the
  // previous result across re-renders: without it, any unrelated re-render
  // would append the same pair of messages again.
  useEffect(() => {
    const created = state?.created;
    if (!created?.length) return;
    const marker = created[created.length - 1].id;
    if (appliedRef.current === marker) return;
    appliedRef.current = marker;
    onGenerated(created);
    setOpen(false);
  }, [state?.created, onGenerated]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <ImageIcon className="size-3.5" />
        Create an image
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <input type="hidden" name="chatId" value={chatId} />
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <ImageIcon className="size-3.5" />
          Create an image
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600">
          <X className="size-3.5" />
        </button>
      </div>

      <FormMessage state={state} />

      <div className="flex items-center gap-2">
        <Input name="prompt" required placeholder="A watercolour fox reading a newspaper…" className="flex-1" />
        <GenerateButton />
      </div>
      <p className="text-[11px] text-slate-400">Costs credits per image, and takes a few seconds.</p>
    </form>
  );
}
