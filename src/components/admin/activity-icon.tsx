import {
  CirclePlus, CircleMinus, Pencil, LogIn, CreditCard, Sparkles, Settings, Activity,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A glyph and a colour for an audit-log action.
 *
 * The activity feed rendered every entry as the same line of grey text, so ten
 * rows were a paragraph rather than a list — you could not skim it for "did
 * anything get deleted", which is the main reason to look at an audit log at
 * all. `activityLog.action` was already being fetched and used only as a
 * fallback when `description` happened to be null.
 *
 * Matched by **prefix and keyword** rather than an exhaustive map: actions are
 * free-text strings written at each call site (`persona.created`,
 * `order.paid`, `settings.updated`), so an exact list would silently fall
 * through to grey the first time somebody logged a new verb. The default is a
 * neutral pulse, which is honest rather than wrong.
 */

type Rule = { match: RegExp; icon: LucideIcon; tone: string };

const RULES: Rule[] = [
  { match: /delet|remov|revok|suspend/i, icon: CircleMinus, tone: 'text-rose-400 bg-rose-500/10' },
  { match: /creat|add|publish|install|grant/i, icon: CirclePlus, tone: 'text-emerald-400 bg-emerald-500/10' },
  { match: /updat|edit|chang|renam/i, icon: Pencil, tone: 'text-amber-400 bg-amber-500/10' },
  { match: /login|sign.?in|auth/i, icon: LogIn, tone: 'text-sky-400 bg-sky-500/10' },
  { match: /order|payment|paid|refund|credit|billing/i, icon: CreditCard, tone: 'text-emerald-400 bg-emerald-500/10' },
  { match: /persona|chat|message/i, icon: Sparkles, tone: 'text-violet-400 bg-violet-500/10' },
  { match: /setting|config|theme|brand/i, icon: Settings, tone: 'text-slate-400 bg-white/5' },
];

export function ActivityIcon({ action, className }: { action: string | null; className?: string }) {
  const rule = action ? RULES.find((r) => r.match.test(action)) : undefined;
  const Icon = rule?.icon ?? Activity;

  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-lg',
        rule?.tone ?? 'bg-white/5 text-slate-500',
        className,
      )}
      // The action name is already in the row's text; announcing it twice
      // would just make the feed longer to listen to.
      aria-hidden
      title={action ?? undefined}
    >
      <Icon className="size-3.5" />
    </span>
  );
}
