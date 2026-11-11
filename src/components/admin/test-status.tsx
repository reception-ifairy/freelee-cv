import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';

/**
 * How a check's answer looks, everywhere one is shown.
 *
 * Started life as `HealthBanner` inside provider-card.tsx, when "Test
 * connection" only existed for AI providers. It moved here when every key in
 * the admin — Stripe, Resend, S3, knowledge sources — got the same Test
 * button, so one answer looks the same wherever it appears.
 *
 * "no credit" keeps its own amber tone on purpose: the key is accepted, the
 * model list loads, and every other signal says the provider is fine while
 * nothing can actually run.
 */
export const TEST_STATE_STYLES: Record<string, { tone: string; Icon: typeof CircleCheck }> = {
  ok: { tone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300', Icon: CircleCheck },
  'no-credit': { tone: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', Icon: CircleAlert },
  'no-key': { tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', Icon: CircleAlert },
  'bad-key': { tone: 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300', Icon: CircleX },
  error: { tone: 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300', Icon: CircleX },
};

export function TestStatus({
  state,
  message,
  at,
  className,
  children,
}: {
  state: string;
  message: string;
  /** ISO time of the check, shown as "tested 5 minutes ago". */
  at?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const style = TEST_STATE_STYLES[state] ?? TEST_STATE_STYLES.error;

  return (
    <div role="status" className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs', style.tone, className)}>
      <style.Icon className="mt-px size-3.5 shrink-0" />
      <div className="min-w-0 break-words">
        <p>{message}</p>
        {at ? (
          <p className="mt-0.5 opacity-70">
            {/* Relative time is computed on both server and client, which can
                disagree by a second at a minute boundary — harmless, so the
                hydration warning for this one node is silenced rather than
                the time hidden until mount. */}
            Tested{' '}
            <time dateTime={at} title={new Date(at).toUTCString()} suppressHydrationWarning>
              {relativeTime(at)}
            </time>
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
