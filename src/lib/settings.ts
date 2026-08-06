import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

export type SettingValue = string | number | boolean | Record<string, unknown> | null;

/**
 * Runtime, admin-editable configuration. `cache()` deduplicates the read within
 * a render pass, so a page asking for six settings still issues one query.
 */
export const getSettings = cache(async (): Promise<Map<string, SettingValue>> => {
  const rows = await db.select().from(settings);
  const map = new Map<string, SettingValue>();
  for (const row of rows) map.set(row.key, castSetting(row.value, row.type));
  return map;
});

function castSetting(raw: string | null, type: string): SettingValue {
  if (raw === null) return null;

  switch (type) {
    case 'bool':
      return raw === '1' || raw.toLowerCase() === 'true';
    case 'int':
      return Number.parseInt(raw, 10) || 0;
    case 'float':
      return Number.parseFloat(raw) || 0;
    case 'json':
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    default:
      return raw;
  }
}

export async function getSettingString(key: string, fallback = ''): Promise<string> {
  const value = (await getSettings()).get(key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const value = (await getSettings()).get(key);
  return typeof value === 'boolean' ? value : fallback;
}

export async function getSettingInt(key: string, fallback = 0): Promise<number> {
  const value = (await getSettings()).get(key);
  return typeof value === 'number' ? value : fallback;
}

export async function getSettingsGroup(group: string) {
  return db.select().from(settings).where(eq(settings.group, group)).orderBy(settings.position);
}
