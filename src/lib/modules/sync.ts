import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { modules } from '@/db/schema';
import { MODULES } from './registry';

/**
 * Upserts the `modules` table from the static MODULES registry — idempotent,
 * safe to run repeatedly (deploy checklist or `npm run modules:sync`). This
 * is the only writer of `modules`; nothing else inserts or updates it, so
 * the DB row is always a faithful mirror of the code-side manifest.
 *
 * Takes `db` as a parameter, rather than importing the `server-only`-marked
 * app singleton from `@/db`, so this also runs standalone under plain `tsx`
 * (scripts/sync-modules.ts) — the same reason src/db/seed.ts builds its own
 * connection instead of importing `@/db`.
 */
export async function syncModuleRegistry(db: Db): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const manifest of MODULES) {
    const [existing] = await db.select({ id: modules.id }).from(modules).where(eq(modules.key, manifest.key)).limit(1);

    const values = {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      type: manifest.type,
      isCore: manifest.isCore,
      requires: manifest.requires,
      provides: manifest.provides,
      permissions: manifest.permissions ?? [],
      navigation: manifest.navigation ?? [],
    };

    if (existing) {
      await db.update(modules).set({ ...values, updatedAt: new Date() }).where(eq(modules.id, existing.id));
      updated++;
    } else {
      await db.insert(modules).values({ key: manifest.key, ...values });
      inserted++;
    }
  }

  return { inserted, updated };
}
