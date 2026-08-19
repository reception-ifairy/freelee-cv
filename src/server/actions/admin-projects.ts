'use server';

// Named admin-projects.ts, not admin/projects.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { getPlatformTeamId } from '@/lib/teams';
import { slugify } from '@/lib/utils';
import type { ActionState } from './auth';

const projectSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, 'Give the project a name.').max(120),
  description: z.string().trim().max(2000).optional(),
  colour: z.string().trim().max(16).optional(),
  status: z.enum(['active', 'paused', 'done', 'archived']).default('active'),
  // '' means "no cap", which is not the same as 0. Coerced to null rather
  // than to a number, so the two stay distinguishable all the way down.
  budgetCredits: z.string().trim().optional(),
});

function parseBudget(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/** A slug nobody else on the team is using. Same shape as uniquePersonaSlug. */
async function uniqueProjectSlug(teamId: string, name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || `project-${Date.now()}`;
  let candidate = base;

  for (let i = 2; i < 100; i++) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.teamId, teamId), eq(projects.slug, candidate)))
      .limit(1);

    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function saveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const data = parsed.data;

  const teamId = await getPlatformTeamId();
  const values = {
    name: data.name,
    description: data.description || null,
    colour: data.colour || null,
    status: data.status,
    budgetCredits: parseBudget(data.budgetCredits),
    updatedAt: new Date(),
    // Set the moment it moves to archived, cleared if it comes back — so
    // "when was this shelved" survives without a second audit table.
    archivedAt: data.status === 'archived' ? new Date() : null,
  };

  if (data.id) {
    await db
      .update(projects)
      .set({ ...values, slug: await uniqueProjectSlug(teamId, data.name, data.id) })
      .where(eq(projects.id, data.id));
    revalidatePath('/admin/projects');
    revalidatePath(`/admin/projects/${data.id}`);
    return { success: `Saved "${data.name}".` };
  }

  const [created] = await db
    .insert(projects)
    .values({
      ...values,
      teamId,
      slug: await uniqueProjectSlug(teamId, data.name),
      createdBy: admin.id,
    })
    .returning({ id: projects.id });

  revalidatePath('/admin/projects');
  redirect(`/admin/projects/${created.id}`);
}

export async function setProjectStatusAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));
  const status = z.enum(['active', 'paused', 'done', 'archived']).parse(formData.get('status'));

  await db
    .update(projects)
    .set({ status, archivedAt: status === 'archived' ? new Date() : null, updatedAt: new Date() })
    .where(eq(projects.id, id));

  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
}

/**
 * Deletes the container, never the contents.
 *
 * Every `project_id` is `ON DELETE SET NULL`, so the chats, rooms and crews
 * filed under it survive and simply become unfiled. Losing a month of
 * conversations because somebody tidied up a folder would be unforgivable, and
 * this is the one place where that guarantee is easy to break by accident.
 */
export async function deleteProjectAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get('id'));

  await db.delete(projects).where(eq(projects.id, id));

  revalidatePath('/admin/projects');
  redirect('/admin/projects');
}
