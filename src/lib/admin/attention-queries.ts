import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getSettings } from '@/lib/settings';
import { CONNECTION_IDS, connectionView } from '@/lib/connections/registry';
import type { AttentionFacts } from './attention';

/**
 * The facts behind the attention list (attention.ts). The counts are one
 * query of scalar subqueries; connections come from settings already read for
 * the request. Cheap enough for the header badge on every admin page.
 */
export async function attentionFacts(): Promise<AttentionFacts> {
  const [counts] = await db.execute<{
    pending_orders: number;
    new_leads: number;
    listings_to_review: number;
    fields_without_bots: number;
    fields_without_audiences: number;
    bots_other_type: number;
    live_tutors: number;
    homeschool_published: boolean | null;
  }>(sql`
    select
      (select count(*) from orders where status = 'pending')::int as pending_orders,
      (select count(*) from leads where status = 'new')::int as new_leads,
      (select count(*) from listings where status = 'pending_review')::int as listings_to_review,
      (select count(*) from categories c where c.is_active
         and not exists (select 1 from persona_categories pc where pc.category_id = c.id))::int as fields_without_bots,
      (select count(*) from categories c where c.is_active
         and not exists (select 1 from category_audience_segments cas where cas.category_id = c.id))::int as fields_without_audiences,
      -- A segment code starts with its type (B2C-…), so one of another type is a prefix that differs.
      (select count(*) from personas p join persona_versions pv on pv.id = p.current_version_id
         where exists (select 1 from jsonb_array_elements_text(pv.audience_segments) code
                       where left(code, 3) is distinct from pv.audience_type::text))::int as bots_other_type,
      (select count(*) from personas p join persona_versions pv on pv.id = p.current_version_id
         where p.is_active and pv.curriculum_scope is not null)::int as live_tutors,
      (select bool_or(is_published) from pages where slug = 'homeschooling') as homeschool_published
  `);

  const settings = await getSettings();
  const views = CONNECTION_IDS.map((id) => connectionView(id, settings));
  // Saved here or in the server file — a built-in default address is nobody's choice to test.
  const chosen = views.filter((v) => v.configured && v.source !== 'default');


  return {
    pendingOrders: counts?.pending_orders ?? 0,
    newLeads: counts?.new_leads ?? 0,
    listingsToReview: counts?.listings_to_review ?? 0,
    failingConnections: chosen.filter((v) => v.lastTest && v.lastTest.state !== 'ok').map((v) => v.title),
    untestedConnections: chosen.filter((v) => !v.lastTest).map((v) => v.title),
    liveTutors: counts?.live_tutors ?? 0,
    homeschoolPagePublished: Boolean(counts?.homeschool_published),
    fieldsWithoutBots: counts?.fields_without_bots ?? 0,
    fieldsWithoutAudiences: counts?.fields_without_audiences ?? 0,
    botsWithOtherTypeGroups: counts?.bots_other_type ?? 0,
  };
}
