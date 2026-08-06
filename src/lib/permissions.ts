import 'server-only';
import type { TeamMember } from '@/db/schema';

/**
 * Team-level permission strings. Small and hand-maintained deliberately —
 * add one here when a real action needs it, not speculatively.
 */
export const TEAM_PERMISSIONS = [
  'team.manage_members',
  'team.manage_invitations',
  'team.manage_modules',
  'team.view_billing',
  'team.manage_billing',
  'team.transfer_ownership',
  'team.export_data',
  'team.manage_marketplace',
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

/**
 * A role is a *preset* of permissions, not a hard wall — `team_members.permissions`
 * can grant an individual member extra permissions beyond their role's
 * defaults (e.g. a member with `team.manage_modules` but not the `admin`
 * role), matching the concept doc's "role to preset, not a hard wall" design.
 */
const ROLE_DEFAULTS: Record<TeamMember['role'], TeamPermission[]> = {
  owner: [...TEAM_PERMISSIONS], // owner always has every permission
  admin: [
    'team.manage_members', 'team.manage_invitations', 'team.manage_modules',
    'team.view_billing', 'team.export_data', 'team.manage_marketplace',
  ],
  member: [],
  guest: [],
};

export function hasPermission(
  member: Pick<TeamMember, 'role' | 'permissions'>,
  permission: TeamPermission,
): boolean {
  if (member.role === 'owner') return true;
  if (ROLE_DEFAULTS[member.role].includes(permission)) return true;
  return (member.permissions as string[]).includes(permission);
}
