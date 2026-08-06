import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { teamMembers } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { buildExportBundle } from '@/lib/portability/bundle';

/**
 * Self-service "export my team's data" — the GDPR-adjacent baseline the
 * plan called for (docs/15-data-portability.md), available to any team
 * member with `team.export_data` (owner/admin by default), not just
 * platform admins. Delivers the same single-JSON bundle shape
 * scripts/export-bundle.ts writes to disk, as a browser download.
 */
export async function GET() {
  const user = await requireUser();
  const teamId = user.defaultTeamId;

  const [member] = await db
    .select({ role: teamMembers.role, permissions: teamMembers.permissions })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
    .limit(1);

  if (!member || !hasPermission(member, 'team.export_data')) {
    return new Response('Forbidden', { status: 403 });
  }

  const bundle = await buildExportBundle(db, teamId);
  const filename = `freelee-export-${teamId}-${Date.now()}.json`;

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
