'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Eye, EyeOff, Star, StarOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deletePersonaAction, duplicatePersonaAction, togglePersonaAction } from '@/server/actions/admin';

/**
 * What the old Personas grid could do to a bot, on its card in the taxonomy
 * browser (freelee #90). Since the browser is the one list of bots, the card
 * has to carry them: publish, feature, duplicate, delete.
 *
 * A deleted bot's card cannot stay open, so Delete goes back to the list.
 */
export function PersonaCardActions({
  id,
  name,
  isActive,
  isFeatured,
  closeHref,
}: {
  id: number;
  name: string;
  isActive: boolean;
  isFeatured: boolean;
  closeHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (action: (formData: FormData) => Promise<unknown>, fields: Record<string, string | number>, after?: () => void) =>
    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
      await action(formData);
      if (after) after();
      else router.refresh();
    });

  const button = 'inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40';
  const plain = cn(button, 'hairline hover:bg-white/[0.03]');

  return (
    <div>
      <p className="eyebrow mb-2">Actions</p>
      <div className="flex flex-wrap gap-2" aria-busy={pending}>
        <button type="button" disabled={pending} className={plain} onClick={() => run(togglePersonaAction, { id, field: 'isActive' })}>
          {isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {isActive ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" disabled={pending} className={plain} onClick={() => run(togglePersonaAction, { id, field: 'isFeatured' })}>
          {isFeatured ? <StarOff className="size-3.5" /> : <Star className="size-3.5" />}
          {isFeatured ? 'Remove from featured' : 'Mark as featured'}
        </button>
        <button type="button" disabled={pending} className={plain} onClick={() => run(duplicatePersonaAction, { id })}>
          <Copy className="size-3.5" /> Duplicate
        </button>
        <button
          type="button"
          disabled={pending}
          className={cn(button, 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10')}
          onClick={() => {
            if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
            run(deletePersonaAction, { id }, () => {
              router.replace(closeHref, { scroll: false });
              router.refresh();
            });
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
