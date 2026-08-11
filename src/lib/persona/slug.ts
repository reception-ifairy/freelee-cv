import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas } from '@/db/schema';
import { slugify } from '@/lib/utils';

/**
 * A persona slug nobody else is using.
 *
 * Lives here rather than in `server/actions/admin.ts` — where it started —
 * because the bot converter needs it too, and **every export from a
 * `'use server'` file is a callable HTTP endpoint**. Exporting a helper from
 * there to share it would publish it. This module is the shared home.
 */
export async function uniquePersonaSlug(name: string, ignoreId?: number): Promise<string> {
  const base = slugify(name) || `persona-${Date.now()}`;
  let candidate = base;

  for (let i = 2; i < 100; i++) {
    const [existing] = await db
      .select({ id: personas.id })
      .from(personas)
      .where(eq(personas.slug, candidate))
      .limit(1);

    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }

  return `${base}-${Date.now()}`;
}
