'use client';

import {
  Sparkles, Compass, Layers, BookOpen, LifeBuoy, Newspaper, CreditCard, Store,
  MessageSquare, Users, Bot, Rocket, Zap, ShieldCheck, Blocks, GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconKey } from '@/lib/site/nav';

/**
 * Resolves a nav icon key to its component, on the client.
 *
 * The nav model travels from a Server Component to client ones, and a Lucide
 * icon is a function — functions cannot cross that boundary. Keeping the model
 * as strings and resolving here is the same split `BlockIcon` already uses for
 * admin-authored block icons.
 */
const ICONS: Record<NavIconKey, LucideIcon> = {
  sparkles: Sparkles,
  compass: Compass,
  layers: Layers,
  book: BookOpen,
  lifebuoy: LifeBuoy,
  news: Newspaper,
  card: CreditCard,
  store: Store,
  message: MessageSquare,
  users: Users,
  bot: Bot,
  rocket: Rocket,
  zap: Zap,
  shield: ShieldCheck,
  blocks: Blocks,
  graduation: GraduationCap,
};

export function NavIcon({ name, className }: { name: NavIconKey; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}
