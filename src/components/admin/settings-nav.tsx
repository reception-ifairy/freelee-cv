'use client';

import {
  Bot, BookOpen, ChartNoAxesColumn, CreditCard, Cpu, Globe, HardDrive, Layers, Mail, Palette, Plug, ShieldCheck, SlidersHorizontal, Sparkles, Wrench,
} from 'lucide-react';
import { SETTINGS_MAP } from '@/lib/admin/settings-sections';
import { RailItem } from './rail-item';

const ICONS = {
  sliders: SlidersHorizontal,
  globe: Globe,
  chart: ChartNoAxesColumn,
  storage: HardDrive,
  cpu: Cpu,
  layers: Layers,
  bot: Bot,
  mail: Mail,
  card: CreditCard,
  palette: Palette,
  plug: Plug,
  shield: ShieldCheck,
  sparkles: Sparkles,
  wrench: Wrench,
  book: BookOpen,
} as const;

/**
 * The Settings tree (freelee #93): the taxonomy's left rail for Settings —
 * group headings, one compact line per section, the current one tinted. A
 * section's description is its tooltip and the heading above the form, not
 * a second line on every entry; that is what let Integrations' seven entries
 * fit. `meta` carries a count where one helps (Integrations: working/total).
 */
export function SettingsNav({ active, meta = {} }: { active: string; meta?: Record<string, { text: string; title?: string }> }) {
  return (
    <nav className="space-y-4 text-sm" aria-label="Settings sections">
      {SETTINGS_MAP.map((group) => (
        <div key={group.heading}>
          <p className="eyebrow mb-1 px-2" title={group.blurb}>
            {group.heading}
          </p>
          <ul className="space-y-px">
            {group.sections.map((section) => (
              <li key={section.id}>
                <RailItem
                  label={section.label}
                  icon={ICONS[section.icon]}
                  // A section with its own route leaves Settings; anything else is a tab of this page.
                  href={section.href ?? `/admin/settings?section=${section.id}`}
                  active={active === section.id}
                  meta={meta[section.id]?.text}
                  title={meta[section.id]?.title ? `${section.description} — ${meta[section.id]!.title}` : section.description}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
