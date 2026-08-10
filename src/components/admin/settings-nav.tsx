'use client';

import Link from 'next/link';
import {
  Bot, ChartNoAxesColumn, CreditCard, Cpu, Globe, Layers, Mail, Palette, SlidersHorizontal,
} from 'lucide-react';
import { SETTINGS_MAP, type SettingsSection } from '@/lib/admin/settings-sections';
import { cn } from '@/lib/utils';

const ICONS = {
  sliders: SlidersHorizontal,
  globe: Globe,
  chart: ChartNoAxesColumn,
  cpu: Cpu,
  layers: Layers,
  bot: Bot,
  mail: Mail,
  card: CreditCard,
  palette: Palette,
} as const;

/**
 * Grouped settings navigation.
 *
 * Replaces a flat strip of seven lowercase words with headed groups, an icon
 * and a one-line description each — so it is possible to find a setting without
 * already knowing which of seven buckets it was filed under.
 */
export function SettingsNav({ active }: { active: string }) {
  return (
    <nav className="space-y-5" aria-label="Settings sections">
      {SETTINGS_MAP.map((group) => (
        <div key={group.heading}>
          <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{group.heading}</p>
          <p className="mb-2 px-1 text-[11px] leading-snug text-slate-400/80">{group.blurb}</p>
          <ul className="space-y-0.5">
            {group.sections.map((section) => (
              <li key={section.id}>
                <NavItem section={section} active={active === section.id} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavItem({ section, active }: { section: SettingsSection; active: boolean }) {
  const Icon = ICONS[section.icon];
  // A section with its own route leaves settings entirely; anything else is a
  // tab within this page.
  const href = section.href ?? `/admin/settings?section=${section.id}`;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition',
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{section.label}</span>
        <span className="block text-[11px] leading-snug opacity-70">{section.description}</span>
      </span>
    </Link>
  );
}
