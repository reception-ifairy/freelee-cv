import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50',
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-slate-100 dark:divide-slate-800', className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<'tr'>) {
  // `transition` was missing, so row hover snapped on a surface where every
  // other hover in the app eases.
  return <tr className={cn('transition-colors duration-[--duration-fast] hover:bg-slate-50 dark:hover:bg-white/[0.04]', className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('px-5 py-3 font-medium', className)} {...props} />;
}

export function TD({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-5 py-3', className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-16 text-center text-slate-400">
        {children}
      </td>
    </tr>
  );
}
