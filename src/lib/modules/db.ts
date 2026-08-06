import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { modules, moduleTeam, type ModuleRow } from '@/db/schema';

/**
 * Core modules are always enabled. Feature modules default to **disabled**
 * until a team explicitly turns them on (no `module_team` row = not
 * enabled) — matching the concept doc's three states: absent / installed-
 * but-disabled / enabled-for-team-X. See docs/09-team-authorization.md.
 */
export async function isModuleEnabledForTeam(teamId: string, key: string): Promise<boolean> {
  const [module] = await db.select().from(modules).where(eq(modules.key, key)).limit(1);
  if (!module) return false;
  if (module.isCore) return true;

  const [row] = await db
    .select({ enabled: moduleTeam.enabled })
    .from(moduleTeam)
    .where(and(eq(moduleTeam.moduleId, module.id), eq(moduleTeam.teamId, teamId)))
    .limit(1);

  return row?.enabled ?? false;
}

/**
 * Route-level guard for feature modules — call at the top of a module's page
 * or route handler. Throws (Next.js's `notFound()` semantics are the
 * caller's job — this just decides yes/no) rather than silently rendering a
 * disabled feature. First real caller: src/app/(app)/rooms/**, Phase 6.
 */
export async function assertModuleEnabled(teamId: string, key: string): Promise<void> {
  if (!(await isModuleEnabledForTeam(teamId, key))) {
    throw new Error(`MODULE_DISABLED:${key}`);
  }
}

export type ModuleWithTeamState = ModuleRow & { enabledForTeam: boolean };

/** Every registered module, annotated with whether it's on for this team — for the team-settings page. */
export async function listModulesForTeam(teamId: string): Promise<ModuleWithTeamState[]> {
  const all = await db.select().from(modules);
  const rows = await db.select().from(moduleTeam).where(eq(moduleTeam.teamId, teamId));
  const enabledByModuleId = new Map(rows.map((r) => [r.moduleId, r.enabled]));

  return all.map((module) => ({
    ...module,
    enabledForTeam: module.isCore ? true : (enabledByModuleId.get(module.id) ?? false),
  }));
}
