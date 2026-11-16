/**
 * Every outside service the platform talks to, grouped (2026-11-14). Since
 * freelee #93 the groups are sections of Settings → Integrations
 * (`?section=integrations-<group>`); /admin/connections redirects there.
 * First grouped on 2026-11-14. The 13 cards (Save → Test → Fetch, docs/51) were spread over
 * four settings sections — and Billing, Email and Media storage held a card
 * and little else — so "is everything connected?" took four screens. Now one.
 *
 * Plain module: the page and `scripts/verify-settings-map.ts` share it. The
 * check makes sure every connection appears exactly once.
 */
import type { ConnectionId } from '@/lib/connections/registry';

export type ConnectionGroup = { id: string; heading: string; blurb: string; ids: readonly ConnectionId[] };

export const CONNECTION_GROUPS: readonly ConnectionGroup[] = [
  {
    id: 'ai',
    heading: 'AI providers',
    blurb: 'Save a key, press Test, then Fetch models to bring in what the provider offers. Which models customers may use is under Settings → Models.',
    ids: ['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'stability'],
  },
  { id: 'tools', heading: 'Tools for bots', blurb: 'Services bots call on while they answer.', ids: ['tavily', 'elevenlabs'] },
  { id: 'knowledge', heading: 'Knowledge', blurb: 'The curriculum is what tutor bots teach from.', ids: ['curriculum'] },
  { id: 'email', heading: 'Email', blurb: 'Sign-up confirmations, password resets and receipts. The sender address is under Settings → Email.', ids: ['resend'] },
  { id: 'payments', heading: 'Payments', blurb: 'Read-only checks that Stripe and PayPal answer. Bank transfer details are under Settings → Billing.', ids: ['stripe', 'paypal'] },
  { id: 'storage', heading: 'Storage', blurb: 'Where uploaded and generated images are kept.', ids: ['s3'] },
];

export type ConnectionHealth = 'working' | 'failing' | 'untested' | 'off';

export const HEALTH_LABEL: Record<ConnectionHealth, string> = {
  working: 'Working',
  failing: 'Failing',
  untested: 'Never tested',
  off: 'Not set up',
};

/** One word for a card: not set up, never tested, or what its last test said. */
export function connectionHealth(view: { configured: boolean; lastTest: { state: string } | null }): ConnectionHealth {
  if (!view.configured) return 'off';
  if (!view.lastTest) return 'untested';
  return view.lastTest.state === 'ok' ? 'working' : 'failing';
}

/** The Settings section that lists one group's connections (#93); `integrations` alone lists all of them. */
export const INTEGRATIONS_SECTION = 'integrations';
export const integrationsSectionId = (groupId: string) => `${INTEGRATIONS_SECTION}-${groupId}`;

export function connectionGroupOf(id: string): ConnectionGroup | undefined {
  return CONNECTION_GROUPS.find((group) => (group.ids as readonly string[]).includes(id));
}

/** Where a connection's card opens: its group in Settings → Integrations, with the card open. */
export function connectionHref(id: ConnectionId): string {
  const group = connectionGroupOf(id);
  return `/admin/settings?section=${group ? integrationsSectionId(group.id) : INTEGRATIONS_SECTION}&open=${id}`;
}

/** A group's list in Settings → Integrations. */
export const integrationsHref = (groupId?: string) => `/admin/settings?section=${groupId ? integrationsSectionId(groupId) : INTEGRATIONS_SECTION}`;

/**
 * The old /admin/connections anchors, read on the new page: `#conn-<id>` opens
 * that card, `#group-<id>` that group. Null for any other hash.
 */
export function hrefForConnectionsHash(hash: string): string | null {
  const conn = /^#conn-([a-z0-9]+)$/.exec(hash);
  if (conn && connectionGroupOf(conn[1])) return connectionHref(conn[1] as ConnectionId);
  const group = /^#group-([a-z]+)$/.exec(hash);
  if (group && CONNECTION_GROUPS.some((g) => g.id === group[1])) return integrationsHref(group[1]);
  return null;
}
