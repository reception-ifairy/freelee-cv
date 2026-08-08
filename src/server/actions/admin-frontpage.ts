'use server';

// Named admin-frontpage.ts, not admin/frontpage.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-knowledge-sources.ts.

import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { pageSections } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_CUSTOM_CONTENT_CONFIG, STEP_ICON_KEYS } from '@/components/site/sections/types';
import type { ActionState } from './auth';

export async function toggleSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const isVisible = formData.get('isVisible') === 'true';
  await db.update(pageSections).set({ isVisible: !isVisible, updatedAt: new Date() }).where(eq(pageSections.id, id));
  revalidatePath('/');
  revalidatePath('/admin/frontpage');
}

/** Swaps `position` with the section immediately above/below it — a plain integer swap, not a full renumber, since positions only need a consistent order, not to be contiguous. */
export async function moveSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const direction = z.enum(['up', 'down']).parse(formData.get('direction'));

  const rows = await db.select().from(pageSections).where(eq(pageSections.page, 'home')).orderBy(asc(pageSections.position));
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return;
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return;

  const a = rows[index];
  const b = rows[swapIndex];
  await db.transaction(async (tx) => {
    await tx.update(pageSections).set({ position: b.position, updatedAt: new Date() }).where(eq(pageSections.id, a.id));
    await tx.update(pageSections).set({ position: a.position, updatedAt: new Date() }).where(eq(pageSections.id, b.id));
  });

  revalidatePath('/');
  revalidatePath('/admin/frontpage');
}

/**
 * Typed per-section-type forms (not a single raw-JSON textarea) — matches
 * every other admin form in this app and can't produce a config shape the
 * renderer doesn't expect.
 */
async function saveConfig(id: number, config: unknown): Promise<ActionState> {
  await db.update(pageSections).set({ config, updatedAt: new Date() }).where(eq(pageSections.id, id));
  revalidatePath('/');
  revalidatePath('/admin/frontpage');
  return { success: 'Section updated.' };
}

// titleLead is NOT trimmed — hero.tsx renders `{titleLead}{titleAccent}` back
// to back with no separator, so a deliberate trailing space (e.g. "Your AI
// agency, ") is load-bearing. Still rejects whitespace-only input via the
// trimmed-length check.
const heroSchema = z.object({
  id: z.coerce.number().int(),
  titleLead: z.string().max(120).refine((v) => v.trim().length > 0, 'Title (lead) is required.'),
  titleAccent: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(300),
  primaryLabel: z.string().trim().min(1).max(60),
  secondaryLabel: z.string().trim().min(1).max(60),
});

export async function updateHeroConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = heroSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { id, ...config } = parsed.data;
  return saveConfig(id, config);
}

const ctaSchema = z.object({
  id: z.coerce.number().int(),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(300),
  buttonLabel: z.string().trim().min(1).max(60),
});

export async function updateCtaConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = ctaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { id, ...config } = parsed.data;
  return saveConfig(id, config);
}

const howItWorksSchema = z.object({
  id: z.coerce.number().int(),
  icon: z.array(z.enum(STEP_ICON_KEYS)).length(3),
  title: z.array(z.string().trim().min(1).max(80)).length(3),
  body: z.array(z.string().trim().min(1).max(200)).length(3),
});

export async function updateHowItWorksConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = howItWorksSchema.safeParse({
    id: formData.get('id'),
    icon: formData.getAll('icon'),
    title: formData.getAll('title'),
    body: formData.getAll('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { id, icon, title, body } = parsed.data;
  const steps = icon.map((ic, i) => ({ icon: ic, title: title[i], body: body[i] }));
  return saveConfig(id, { steps });
}

const customContentSchema = z.object({
  id: z.coerce.number().int(),
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal('')),
  ctaHref: z.string().trim().max(300).optional().or(z.literal('')),
});

export async function updateCustomContentConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = customContentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const { id, imageUrl, ctaLabel, ctaHref, ...rest } = parsed.data;
  return saveConfig(id, {
    ...rest,
    imageUrl: imageUrl || undefined,
    ctaLabel: ctaLabel || undefined,
    ctaHref: ctaHref || undefined,
  });
}

export async function createCustomSectionAction() {
  await requireAdmin();
  const rows = await db.select({ position: pageSections.position }).from(pageSections).where(eq(pageSections.page, 'home'));
  const nextPosition = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;

  await db.insert(pageSections).values({
    page: 'home',
    type: 'custom_content',
    position: nextPosition,
    isVisible: true,
    config: DEFAULT_CUSTOM_CONTENT_CONFIG,
  });

  revalidatePath('/');
  revalidatePath('/admin/frontpage');
}

export async function deleteCustomSectionAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));

  // Only ever targets custom_content rows — enforced here, not just hidden in
  // the UI, since a core section has nothing to re-add it with once deleted.
  const [row] = await db.select({ type: pageSections.type }).from(pageSections).where(eq(pageSections.id, id)).limit(1);
  if (!row || row.type !== 'custom_content') return;

  await db.delete(pageSections).where(eq(pageSections.id, id));
  revalidatePath('/');
  revalidatePath('/admin/frontpage');
}
