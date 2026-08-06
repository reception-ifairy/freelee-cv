'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import type { ActionState } from './auth';

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z
    .object({
      name: z.string().trim().min(2, 'Please enter your name.').max(120),
      timezone: z.string().trim().max(64).optional(),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  await db
    .update(users)
    .set({ name: parsed.data.name, timezone: parsed.data.timezone || 'UTC', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/dashboard/profile');
  return { success: 'Profile updated.' };
}
