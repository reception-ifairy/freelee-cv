'use server';

// Named admin-billing.ts, not admin/billing.ts — src/server/actions/admin.ts
// already exists as a file. Same collision workaround as admin-ai-models.ts.

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { plans, passProducts } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import type { ActionState } from './auth';

/* --------------------------------- Plans --------------------------------- */

const planSchema = z.object({
  id: z.coerce.number().int().optional(),
  key: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  intervalUnit: z.enum(['day', 'week', 'month', 'year']),
  intervalCount: z.coerce.number().int().min(1).max(365).default(1),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).default('GBP'),
  creditsPerCycle: z.coerce.number().int().min(0).default(0),
  tier: z.coerce.number().int().min(0).default(1),
  sort: z.coerce.number().int().default(0),
});

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on';
}

export async function savePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const data = parsed.data;
  const values = {
    name: data.name,
    description: data.description ?? null,
    intervalUnit: data.intervalUnit,
    intervalCount: data.intervalCount,
    priceCents: data.priceCents,
    currency: data.currency.toUpperCase(),
    creditsPerCycle: data.creditsPerCycle,
    tier: data.tier,
    sort: data.sort,
    isActive: checkbox(formData, 'isActive'),
    isPublic: checkbox(formData, 'isPublic'),
  };

  if (data.id) {
    await db.update(plans).set(values).where(eq(plans.id, data.id));
  } else {
    await db.insert(plans).values({ key: data.key?.trim() || slugify(data.name), ...values });
  }

  revalidatePath('/admin/plans');
  return { success: 'Plan saved.' };
}

export async function deletePlanAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(plans).where(eq(plans.id, id));
  revalidatePath('/admin/plans');
}

/* ----------------------------- Pass products ------------------------------ */

const passSchema = z.object({
  id: z.coerce.number().int().optional(),
  key: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  durationUnit: z.enum(['hour', 'day', 'week', 'month']),
  durationValue: z.coerce.number().int().min(1).max(365).default(1),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).default('GBP'),
  sort: z.coerce.number().int().default(0),
});

export async function savePassProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = passSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const data = parsed.data;
  const values = {
    name: data.name,
    description: data.description ?? null,
    durationUnit: data.durationUnit,
    durationValue: data.durationValue,
    priceCents: data.priceCents,
    currency: data.currency.toUpperCase(),
    sort: data.sort,
    isActive: checkbox(formData, 'isActive'),
    isPublic: checkbox(formData, 'isPublic'),
  };

  if (data.id) {
    await db.update(passProducts).set(values).where(eq(passProducts.id, data.id));
  } else {
    await db.insert(passProducts).values({ key: data.key?.trim() || slugify(data.name), ...values });
  }

  revalidatePath('/admin/passes');
  return { success: 'Pass saved.' };
}

export async function deletePassProductAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(passProducts).where(eq(passProducts.id, id));
  revalidatePath('/admin/passes');
}
