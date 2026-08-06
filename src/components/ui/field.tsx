import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(base, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(base, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(base, 'h-10 pr-8', className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300', className)}
      {...props}
    />
  );
}

export function Hint({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-xs text-slate-500 dark:text-slate-400', className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800',
        className,
      )}
      {...props}
    />
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state?.error && !state?.success) return null;

  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        state.error
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
      )}
      role="status"
    >
      {state.error ?? state.success}
    </p>
  );
}
