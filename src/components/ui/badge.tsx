import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 glow-ring',
      green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
  },
  defaultVariants: { tone: 'slate' },
});

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
