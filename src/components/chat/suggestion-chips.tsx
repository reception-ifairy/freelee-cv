'use client';

import type { ChatLayoutConfig } from '@/lib/chat/layouts';
import { cn } from '@/lib/utils';

/**
 * Starter and follow-up prompts. The layout decides how loud they are: a
 * learning or quick-help surface leads with them, a technical or screenplay
 * one keeps them out of the way (`hidden` — the persona's suggestions still
 * exist, they're just not part of that interface).
 */
export function SuggestionChips({
  suggestions,
  layout,
  onPick,
  variant = 'starter',
}: {
  suggestions: string[];
  layout: ChatLayoutConfig;
  onPick: (suggestion: string) => void;
  variant?: 'starter' | 'followup';
}) {
  if (suggestions.length === 0 || layout.suggestionStyle === 'hidden') return null;

  const large = layout.suggestionStyle === 'large';
  const minimal = layout.suggestionStyle === 'minimal';

  return (
    <div className={cn('flex flex-wrap gap-2', large ? 'pt-3' : 'pt-1')}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className={cn(
            'rounded-full border font-medium transition',
            large ? 'px-4 py-2.5 text-sm' : minimal ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs',
            variant === 'followup'
              ? 'border-brand-200 bg-brand-50/60 text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:border-brand-600'
              : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-500/10',
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
