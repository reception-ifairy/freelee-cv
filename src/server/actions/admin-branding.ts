'use server';

// Named admin-branding.ts, not admin/branding.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-knowledge-sources.ts.

import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { themes } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { FONT_KEYS } from '@/lib/branding/fonts';
import type { ActionState } from './auth';

const optionalUrl = z.string().trim().url().optional().or(z.literal(''));
const optionalFont = z.enum(FONT_KEYS).optional().or(z.literal(''));

const updateThemeSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(1).max(80),
  customCss: z.string().max(20000).optional(),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  headingFont: optionalFont,
  bodyFont: optionalFont,
});

export async function updateThemeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const tokens: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('token.') && typeof value === 'string' && value.trim()) {
      tokens[key.slice('token.'.length)] = value.trim();
    }
  }

  const parsed = updateThemeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { id, name, customCss, logoUrl, faviconUrl, headingFont, bodyFont } = parsed.data;

  await db
    .update(themes)
    .set({
      name,
      tokens,
      customCss: customCss || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      headingFont: headingFont || null,
      bodyFont: bodyFont || null,
    })
    .where(eq(themes.id, id));

  revalidatePath('/', 'layout');
  revalidatePath('/admin/theme');
  return { success: 'Theme updated.' };
}

const createThemeSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function createThemeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = createThemeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const slug = slugify(parsed.data.name) || `theme-${Date.now()}`;
  try {
    await db.insert(themes).values({ name: parsed.data.name, slug, isActive: false, tokens: {} });
  } catch {
    return { error: `"${slug}" already exists — pick a different name.` };
  }

  revalidatePath('/admin/theme');
  return { success: `Created "${parsed.data.name}".` };
}

export async function activateThemeAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  await db.transaction(async (tx) => {
    await tx.update(themes).set({ isActive: false }).where(sql`true`);
    await tx.update(themes).set({ isActive: true }).where(eq(themes.id, id));
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/theme');
}

export async function duplicateThemeAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [source] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!source) return;

  const name = `${source.name} copy`;
  const slug = `${source.slug}-copy-${Date.now().toString(36)}`;
  await db.insert(themes).values({
    name,
    slug,
    isActive: false,
    tokens: source.tokens,
    customCss: source.customCss,
    logoUrl: source.logoUrl,
    faviconUrl: source.faviconUrl,
    headingFont: source.headingFont,
    bodyFont: source.bodyFont,
  });

  revalidatePath('/admin/theme');
}

export async function deleteThemeAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  const [theme] = await db.select({ isActive: themes.isActive }).from(themes).where(eq(themes.id, id)).limit(1);
  if (!theme || theme.isActive) return; // can't delete the active theme

  await db.delete(themes).where(eq(themes.id, id));
  revalidatePath('/admin/theme');
}
