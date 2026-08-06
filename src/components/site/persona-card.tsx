import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import type { Persona } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { formatCredits, initialsOf, truncate } from '@/lib/utils';

type Props = {
  persona: Pick<
    Persona,
    'name' | 'slug' | 'tagline' | 'description' | 'expertise' | 'accentColor'
    | 'isPremium' | 'audienceType' | 'messagesCount'
  >;
};

export function PersonaCard({ persona }: Props) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700">
      <div
        className="h-20 w-full"
        style={{
          background: `linear-gradient(135deg, ${persona.accentColor}22, ${persona.accentColor}05)`,
        }}
      />

      <div className="-mt-9 px-5 pb-5">
        <div
          className="grid size-16 place-items-center rounded-2xl border-4 border-white text-lg font-bold text-white shadow-sm dark:border-slate-900"
          style={{ background: persona.accentColor }}
          aria-hidden="true"
        >
          {initialsOf(persona.name)}
        </div>

        <div className="mt-3 flex items-start gap-2">
          <h3 className="text-base font-semibold leading-tight">
            <Link href={`/personas/${persona.slug}`} className="after:absolute after:inset-0">
              {persona.name}
            </Link>
          </h3>
          {persona.isPremium ? <Badge tone="amber">Premium</Badge> : null}
        </div>

        {persona.expertise ? (
          <p className="mt-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">{persona.expertise}</p>
        ) : null}

        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {persona.tagline ?? truncate(persona.description, 90)}
        </p>

        <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {formatCredits(persona.messagesCount)}
          </span>
          {persona.audienceType ? <Badge tone="brand">{persona.audienceType}</Badge> : null}
        </div>
      </div>
    </article>
  );
}
