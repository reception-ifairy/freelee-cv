'use server';

import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { chats, leads } from '@/db/schema';
import { currentUser, requireAdmin } from '@/lib/auth';
import { guestToken } from '@/server/actions/chat';
import { leadTool, LEAD_STATUSES } from '@/lib/leads/catalog';
import { checkRateLimit } from '@/lib/rate-limit';
import type { ActionState } from './auth';

/**
 * Captures a lead from one of the assistant's conversational tools.
 *
 * **Public and unauthenticated**, so it gets the same treatment as the
 * assistant itself: the tool is validated against the catalog rather than
 * trusted, only the fields that tool declares are stored, and it is rate
 * limited — an open endpoint that writes rows is a spam target, and the rows
 * here are ones a person is expected to act on.
 */
export async function captureLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get('kind') ?? '');
  const tool = leadTool(kind);
  if (!tool) return { error: 'That is not something we can send.' };

  const user = await currentUser();
  const key = user?.id ?? (await guestToken());

  const gate = checkRateLimit({ name: 'lead-capture', key, limit: 6, windowMs: 60 * 60 * 1000 });
  if (!gate.ok) return { error: 'That has been sent a few times already. Try again a little later.' };

  // Only the fields this tool declares — a crafted payload cannot add columns
  // of its own, and a field the tool never showed cannot arrive filled in.
  const values: Record<string, string> = {};
  for (const field of tool.fields) {
    const raw = String(formData.get(field.key) ?? '').trim().slice(0, field.type === 'textarea' ? 1000 : 200);
    if (field.required && !raw) return { error: `${field.label} is needed.` };
    if (raw) values[field.key] = raw;
  }

  if (values.email && !z.string().email().safeParse(values.email).success) {
    return { error: 'That email address does not look right.' };
  }

  const chatId = String(formData.get('chatId') ?? '') || null;
  const chat = chatId ? (await db.select().from(chats).where(eq(chats.id, chatId)).limit(1))[0] : undefined;

  await db.insert(leads).values({
    kind,
    name: values.name ?? null,
    email: values.email ?? null,
    phone: values.phone ?? null,
    note: values.note ?? null,
    chatId: chat?.id ?? null,
    personaId: chat?.personaId ?? null,
    userId: user?.id ?? null,
  });

  revalidatePath('/admin/leads');
  return { success: tool.done };
}

export async function setLeadStatusAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const status = z.enum(LEAD_STATUSES).parse(formData.get('status'));
  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, id));
  revalidatePath('/admin/leads');
}

export async function deleteLeadAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath('/admin/leads');
}

/** Newest first, optionally narrowed to one status. */
export async function listLeads(status?: string) {
  await requireAdmin();
  return db
    .select()
    .from(leads)
    .where(status && (LEAD_STATUSES as readonly string[]).includes(status) ? eq(leads.status, status) : undefined)
    .orderBy(desc(leads.createdAt))
    .limit(200);
}

