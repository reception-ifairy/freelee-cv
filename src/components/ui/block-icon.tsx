import {
  Bolt, Check, Clock, Gift, Globe, Heart, Lock, Mail, MessageSquare, Phone,
  Rocket, Shield, Sparkles, Star, TrendingUp, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isBlockIconKey, type BlockIconKey } from '@/lib/blocks/catalog';

/**
 * Resolves a curated icon key to a real component.
 *
 * The catalog stores a key, never a component or an arbitrary icon name — an
 * unrecognised name would otherwise be an undefined component and a render-time
 * crash. Anything unknown falls back to `Sparkles` rather than throwing, the
 * same fail-open posture as the block renderer itself.
 */
const ICONS: Record<BlockIconKey, LucideIcon> = {
  users: Users,
  'message-square': MessageSquare,
  bolt: Bolt,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  star: Star,
  check: Check,
  clock: Clock,
  globe: Globe,
  lock: Lock,
  rocket: Rocket,
  chart: TrendingUp,
  gift: Gift,
  phone: Phone,
  mail: Mail,
};

export function iconComponent(key: unknown): LucideIcon {
  return isBlockIconKey(key) ? ICONS[key] : Sparkles;
}

export function BlockIcon({ name, className }: { name: unknown; className?: string }) {
  const Icon = iconComponent(name);
  return <Icon className={className} />;
}
