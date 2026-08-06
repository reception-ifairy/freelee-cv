import type { Metadata } from 'next';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { teams, teamMembers, teamInvitations, users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { listModulesForTeam } from '@/lib/modules/db';
import { removeMemberAction, changeMemberRoleAction, toggleModuleForTeamAction } from '@/server/actions/team';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import { InviteForm } from './invite-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team' };

const ROLE_TONE = { owner: 'brand', admin: 'green', member: 'slate', guest: 'slate' } as const;

export default async function TeamPage() {
  const session = await requireUser();
  const teamId = session.defaultTeamId;

  const [[team], memberRows, pendingInvites, moduleRows] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, teamId)).limit(1),
    db
      .select({
        userId: teamMembers.userId,
        role: teamMembers.role,
        permissions: teamMembers.permissions,
        joinedAt: teamMembers.joinedAt,
        name: users.name,
        email: users.email,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId)),
    db
      .select()
      .from(teamInvitations)
      .where(
        and(eq(teamInvitations.teamId, teamId), isNull(teamInvitations.acceptedAt), gt(teamInvitations.expiresAt, new Date())),
      ),
    listModulesForTeam(teamId),
  ]);

  if (!team) throw new Error('Team not found.');

  const me = memberRows.find((m) => m.userId === session.id);
  const canManageMembers = me ? hasPermission(me, 'team.manage_members') : false;
  const canManageInvites = me ? hasPermission(me, 'team.manage_invitations') : false;
  const canManageModules = me ? hasPermission(me, 'team.manage_modules') : false;
  const canExportData = me ? hasPermission(me, 'team.export_data') : false;

  return (
    <div className="container-app py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Plan: {team.planKey} · {memberRows.length} member{memberRows.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Who has access to this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {memberRows.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-slate-400">{member.email}</p>
                </div>
                <span className="text-xs text-slate-400">Joined {relativeTime(member.joinedAt)}</span>

                {canManageMembers && member.role !== 'owner' ? (
                  <form action={changeMemberRoleAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="teamId" value={teamId} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-brand-600 hover:underline">
                      Save
                    </button>
                  </form>
                ) : (
                  <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                )}

                {canManageMembers && member.role !== 'owner' ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="teamId" value={teamId} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <button type="submit" className="text-xs font-medium text-rose-500 hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            ))}

            {pendingInvites.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-2 text-xs font-medium text-slate-400">Pending invitations</p>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-2 py-2 text-sm">
                    <span className="flex-1 truncate">{invite.email}</span>
                    <Badge tone="amber">pending · {invite.role}</Badge>
                  </div>
                ))}
              </div>
            ) : null}

            {canManageInvites ? (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <InviteForm teamId={teamId} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>Optional capabilities for this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {moduleRows.map((module) => (
              <div key={module.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{module.name}</p>
                  <p className="truncate text-xs text-slate-400">{module.description || module.type}</p>
                </div>

                {module.isCore ? (
                  <Badge tone="brand">always on</Badge>
                ) : canManageModules ? (
                  <form action={toggleModuleForTeamAction}>
                    <input type="hidden" name="teamId" value={teamId} />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <input type="hidden" name="enabled" value={String(!module.enabledForTeam)} />
                    <button
                      type="submit"
                      className={
                        module.enabledForTeam
                          ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800'
                      }
                    >
                      {module.enabledForTeam ? 'On' : 'Off'}
                    </button>
                  </form>
                ) : (
                  <Badge tone={module.enabledForTeam ? 'green' : 'slate'}>
                    {module.enabledForTeam ? 'on' : 'off'}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {canExportData ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Export data</CardTitle>
              <CardDescription>
                Download everything this workspace owns — personas and their full version history, crews,
                room/crew-run conversations, direct chats, and usage — as one JSON bundle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="/dashboard/team/export"
                className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Download export
              </a>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
