import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold transition ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-black ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-on-brand shadow-sm hover:bg-brand-700 active:scale-[.98] glow-btn',
        secondary:
          'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        danger: 'bg-rose-600 text-white hover:bg-rose-700',
        link: 'text-brand-600 underline-offset-4 hover:underline dark:text-brand-400',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {
  /**
   * Shows a spinner and disables the button.
   *
   * Thirteen admin forms were each hand-wiring `useFormStatus` + `Loader2` +
   * a swapped label, which is thirteen chances to forget the `disabled` and
   * let someone submit twice.
   */
  loading?: boolean;
  /** Replaces the label while loading. Without it the label stays put and only the spinner appears — usually the better choice, since a shifting label makes the button resize mid-click. */
  loadingLabel?: string;
};

export function Button({ className, variant, size, loading, loadingLabel, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      // `aria-busy` rather than only `disabled`: a screen reader should hear
      // "busy", not silence, and disabling alone announces nothing.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export { buttonVariants };
