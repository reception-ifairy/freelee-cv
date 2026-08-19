'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Square } from 'lucide-react';
import { cancelCrewRunAction } from '@/server/actions/admin-crews';

/**
 * Live refresh and cancel.
 *
 * Polling rather than the SSE stream: `/api/rooms/[id]/stream` authorises by
 * `assertParticipant`, and an admin watching somebody else's run is not a
 * participant in it. Adding an admin bypass to that route would widen who can
 * open a live feed of any conversation on the platform, which is a bigger
 * decision than this screen needs to make. Three seconds is plenty for a run
 * whose steps take about a second each.
 *
 * It stops entirely once the run is terminal, so a finished run costs nothing.
 */
export function RunControls({ runId, live, cancellable }: { runId: string; live: boolean; cancellable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [live, router]);

  return (
    <>
      {live ? (
        <span className="inline-flex items-center gap-2 rounded-control border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
          <Loader2 className="size-3.5 animate-spin" />
          Running
        </span>
      ) : null}

      {cancellable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const data = new FormData();
              data.set('runId', runId);
              await cancelCrewRunAction(data);
              router.refresh();
            })
          }
          title="Takes effect after the current step finishes — a model call already in flight cannot be aborted."
          className="inline-flex h-10 items-center gap-2 rounded-control border border-rose-500/30 px-4 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-60"
        >
          <Square className="size-3.5" />
          {pending ? 'Stopping…' : 'Stop run'}
        </button>
      ) : null}
    </>
  );
}
