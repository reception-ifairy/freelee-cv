'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { promoteMessageAction } from '@/server/actions/admin-showcase';
import type { PromotableMessage } from '@/lib/showcase/queries';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/field';

/**
 * Promote a real generated image into the showcase.
 *
 * Only an id and a title are submitted — the server re-reads the message and
 * takes the image, persona and prompt from it. The prompt arrives hidden by
 * default, because a real customer's wording can carry things they would not
 * expect to see published.
 */
export function PromotePanel({ candidates }: { candidates: PromotableMessage[] }) {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return (
      <Card className="p-5 text-sm text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Nothing to promote yet</p>
        <p className="mt-1">
          Once a persona with image generation produces a picture in a conversation, it appears here and can be
          added to the showcase in one click. Until then, add pieces by hand above.
        </p>
      </Card>
    );
  }

  function promote(id: string) {
    const formData = new FormData();
    formData.set('messageId', id);
    formData.set('title', titles[id]?.trim() || 'Untitled');
    startTransition(async () => {
      const result = await promoteMessageAction(formData);
      setMessage(result?.success ?? result?.error ?? null);
    });
  }

  return (
    <div className="space-y-3">
      {message ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="flex flex-col gap-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated image served from this host */}
            <img src={candidate.imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <p className="text-xs text-slate-400">{candidate.personaName ?? 'Unknown persona'}</p>
            <Input
              value={titles[candidate.id] ?? ''}
              onChange={(event) => setTitles((current) => ({ ...current, [candidate.id]: event.target.value }))}
              placeholder="Title for the showcase"
            />
            <button
              type="button"
              onClick={() => promote(candidate.id)}
              disabled={pending}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" /> Add to showcase
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
