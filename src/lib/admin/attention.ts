/**
 * What needs the owner's attention, as a list of things to act on — the
 * dashboard's first panel and the header's badge (2026-11-14). The dashboard
 * showed platform totals and one banner for pending orders; with 20 messages
 * and no orders a month, totals say little, and what does need doing was
 * scattered over a dozen screens.
 *
 * Plain module: the facts are gathered elsewhere (attention-queries.ts), and
 * this only turns them into items, so `scripts/verify-attention.ts` checks the
 * rules without a database.
 *
 * Three levels:
 * - **act** — someone is waiting or something is broken: an order to
 *   confirm, a lead, a listing to review, a connection that fails;
 * - **check** — the site may be promising what the platform cannot do yet,
 *   or a field is below its market's risk floor, or a key was never tested;
 * - **tidy** — data that is incomplete but harms nobody today.
 * Only "act" items count towards the header badge.
 */

export type AttentionLevel = 'act' | 'check' | 'tidy';

export type AttentionItem = {
  id: string;
  level: AttentionLevel;
  count: number;
  title: string;
  detail: string;
  href: string;
};

export type AttentionFacts = {
  pendingOrders: number;
  newLeads: number;
  listingsToReview: number;
  /** Connections that are configured and whose last test did not pass, by title. */
  failingConnections: string[];
  /** Configured but never tested. */
  untestedConnections: string[];
  liveTutors: number;
  homeschoolPagePublished: boolean;
  fieldsWithoutBots: number;
  fieldsWithoutAudiences: number;
  /** Bots holding audience groups of another type (stored, never in the prompt — #77). */
  botsWithOtherTypeGroups: number;
  /** Fields below the risk floor of a market they serve; null when not worked out (the header badge skips it). */
  belowRiskFloor: { pillar: string; label: string; fields: number }[] | null;
};

const LEVEL_ORDER: Record<AttentionLevel, number> = { act: 0, check: 1, tidy: 2 };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function attentionItems(f: AttentionFacts): AttentionItem[] {
  const items: AttentionItem[] = [];
  const add = (item: AttentionItem) => {
    if (item.count > 0) items.push(item);
  };

  add({
    id: 'orders',
    level: 'act',
    count: f.pendingOrders,
    title: `${plural(f.pendingOrders, 'order', 'orders')} awaiting payment confirmation`,
    detail: 'Bank transfers and manual payments wait for you to confirm them.',
    href: '/admin/sales',
  });
  add({
    id: 'leads',
    level: 'act',
    count: f.newLeads,
    title: `${plural(f.newLeads, 'new lead', 'new leads')}`,
    detail: 'Enquiries nobody has contacted yet.',
    href: '/admin/leads',
  });
  add({
    id: 'listings',
    level: 'act',
    count: f.listingsToReview,
    title: `${plural(f.listingsToReview, 'marketplace listing', 'marketplace listings')} to review`,
    detail: 'Vendors are waiting for approval.',
    href: '/admin/marketplace',
  });
  add({
    id: 'connections-failing',
    level: 'act',
    count: f.failingConnections.length,
    title: `${plural(f.failingConnections.length, 'connection', 'connections')} failing`,
    detail: `Last test did not pass: ${f.failingConnections.join(', ')}.`,
    href: '/admin/connections',
  });
  add({
    id: 'tutors',
    level: 'check',
    count: f.liveTutors === 0 && f.homeschoolPagePublished ? 1 : 0,
    title: 'No tutor is live',
    detail: '/homeschooling is published; it says tutors are in preparation. Change its copy when the first one goes live.',
    href: '/admin/markets/homeschooling?tab=tutors',
  });
  for (const floor of f.belowRiskFloor ?? []) {
    add({
      id: `floor-${floor.pillar}`,
      level: 'check',
      count: floor.fields,
      title: `${plural(floor.fields, 'field', 'fields')} below the risk floor of ${floor.label}`,
      detail: 'A field serving this market carries a lower risk level than the market asks for.',
      href: `/admin/markets/${floor.pillar}`,
    });
  }
  add({
    id: 'connections-untested',
    level: 'check',
    count: f.untestedConnections.length,
    title: `${plural(f.untestedConnections.length, 'connection', 'connections')} never tested`,
    detail: `A key is saved but nobody pressed Test: ${f.untestedConnections.join(', ')}.`,
    href: '/admin/connections',
  });
  add({
    id: 'fields-no-bots',
    level: 'tidy',
    count: f.fieldsWithoutBots,
    title: `${plural(f.fieldsWithoutBots, 'field has', 'fields have')} no bot`,
    detail: 'Visible categories with nothing filed under them.',
    href: '/admin/taxonomy',
  });
  add({
    id: 'fields-no-audiences',
    level: 'tidy',
    count: f.fieldsWithoutAudiences,
    title: `${plural(f.fieldsWithoutAudiences, 'field has', 'fields have')} no audience`,
    detail: 'A bot designed there is designed for everyone — which usually means nobody.',
    href: '/admin/taxonomy',
  });
  add({
    id: 'bots-other-type',
    level: 'tidy',
    count: f.botsWithOtherTypeGroups,
    title: `${plural(f.botsWithOtherTypeGroups, 'bot holds', 'bots hold')} audience groups of another type`,
    detail: 'Stored but never in the prompt; usually copied from the field. Harmless, but misleading in the editor.',
    href: '/admin/taxonomy?groups=other-type',
  });

  return items.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** The header badge: how many things someone is waiting on. */
export function actCount(items: AttentionItem[]): number {
  return items.filter((i) => i.level === 'act').length;
}
