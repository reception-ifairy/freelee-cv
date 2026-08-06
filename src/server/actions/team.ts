'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { teamMembers, teamInvitations, modules, moduleTeam, activityLog } from '@/db/schema';
import { requireUser, requireTeamPermission } from '@/lib/auth';
import type { ActionState } from './auth';

const INVITE_TTL_DAYS = 7;

/* -------------------------------- Invites -------------------------------- */

const inviteSchema = z.object({
  teamId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'member', 'guest']), // owner is never granted by invite
});

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid invite.' };

  const { teamId, email, role } = parsed.data;
  await requireTeamPermission(teamId, 'team.manage_invitations');
  const inviterUser = await requireUser();

  const token = randomUUID().replace(/-/g, '');
  await db.insert(teamInvitations).values({
    teamId,
    email,
    role,
    token,
    invitedBy: inviterUser.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  await db.insert(activityLog).values({
    userId: inviterUser.id,
    teamId,
    action: 'team.invitation.created',
    description: `Invited ${email} as ${role}`,
    targetType: 'team_invitation',
  });

  revalidatePath('/dashboard/team');
  // No email infra exists in this app yet (no provider configured anywhere) —
  // the invite link is surfaced directly in the UI for the inviter to share
  // manually. See docs/09-team-authorization.md's "known gaps" section.
  return { success: `Invite created. Share this link: /invite/${token}` };
}

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = z.string().min(1).parse(formData.get('token'));
  const user = await requireUser();

  const [invitation] = await db.select().from(teamInvitations).where(eq(teamInvitations.token, token)).limit(1);
  if (!invitation) return { error: 'This invitation is invalid.' };
  if (invitation.acceptedAt) return { error: 'This invitation has already been used.' };
  if (invitation.expiresAt < new Date()) return { error: 'This invitation has expired.' };
  if (invitation.email !== user.email?.toLowerCase()) {
    return { error: 'This invitation was sent to a different email address.' };
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(teamMembers)
      .values({ teamId: invitation.teamId, userId: user.id, role: invitation.role })
      .onConflictDoNothing({ target: [teamMembers.teamId, teamMembers.userId] });

    await tx.update(teamInvitations).set({ acceptedAt: new Date() }).where(eq(teamInvitations.id, invitation.id));
  });

  await db.insert(activityLog).values({
    userId: user.id,
    teamId: invitation.teamId,
    action: 'team.invitation.accepted',
    targetType: 'team_invitation',
    targetId: String(invitation.id),
  });

  revalidatePath('/dashboard/team');
  return { success: 'You have joined the team.' };
}

/* -------------------------------- Members --------------------------------- */

export async function removeMemberAction(formData: FormData) {
  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const memberUserId = z.string().min(1).parse(formData.get('userId'));

  const actor = await requireTeamPermission(teamId, 'team.manage_members');

  const [target] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)))
    .limit(1);
  if (!target) return;
  if (target.role === 'owner') throw new Error('Cannot remove the team owner — transfer ownership first.');

  await db.delete(teamMembers).where(eq(teamMembers.id, target.id));

  await db.insert(activityLog).values({
    userId: actor.userId,
    teamId,
    action: 'team.member.removed',
    targetType: 'user',
    targetId: memberUserId,
  });

  revalidatePath('/dashboard/team');
}

const changeRoleSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['admin', 'member', 'guest']), // ownership changes go through a dedicated transfer, not this
});

export async function changeMemberRoleAction(formData: FormData) {
  const parsed = changeRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { teamId, userId, role } = parsed.data;
  const actor = await requireTeamPermission(teamId, 'team.manage_members');

  const [target] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  if (!target || target.role === 'owner') return;

  await db.update(teamMembers).set({ role }).where(eq(teamMembers.id, target.id));

  await db.insert(activityLog).values({
    userId: actor.userId,
    teamId,
    action: 'team.member.role_changed',
    targetType: 'user',
    targetId: userId,
    oldValues: { role: target.role },
    newValues: { role },
  });

  revalidatePath('/dashboard/team');
}

/* -------------------------------- Modules ---------------------------------
 * Toggling a module is here (not in a modules-specific action file) because
 * it's inseparable from team settings today — there's exactly one place in
 * the UI this is exposed. Revisit if/when a module has its own settings page.
 * --------------------------------------------------------------------------*/

const toggleModuleSchema = z.object({
  teamId: z.string().min(1),
  moduleId: z.coerce.number().int(),
  enabled: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function toggleModuleForTeamAction(formData: FormData) {
  const parsed = toggleModuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { teamId, moduleId, enabled } = parsed.data;
  const actor = await requireTeamPermission(teamId, 'team.manage_modules');

  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!module || module.isCore) return; // core modules can't be toggled

  await db
    .insert(moduleTeam)
    .values({ moduleId, teamId, enabled, enabledBy: actor.userId })
    .onConflictDoUpdate({
      target: [moduleTeam.moduleId, moduleTeam.teamId],
      set: { enabled, enabledAt: new Date(), enabledBy: actor.userId },
    });

  await db.insert(activityLog).values({
    userId: actor.userId,
    teamId,
    action: enabled ? 'team.module.enabled' : 'team.module.disabled',
    targetType: 'module',
    targetId: module.key,
  });

  revalidatePath('/dashboard/team');
}
