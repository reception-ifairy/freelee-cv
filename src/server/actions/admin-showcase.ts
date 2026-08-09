'use server';

import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { chats, messages, showcaseItems } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import type { ActionState } from './auth';

const urlOrPath = z
  .string()
  .trim()
  .min(1, 'An image is required.')
  .max(1000)
  // Root-relative is allowed because generated images are served from this
  // host by /uploads/[name]; anything else must be an absolute http(s) URL, or
  // it would resolve against whatever page the showcase happens to sit on.
  .refine((value) => /^(https?:\/\/|\/)/i.test(value), 'The image must be a URL or a path starting with /.');

const itemSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1, 'A title is required.').max(120),
  caption: z.string().trim().max(400).optional().or(z.literal('')),
  mediaUrl: urlOrPath,
  mediaType: z.string().trim().max(60).optional().or(z.literal('')),
  prompt: z.string().trim().max(2000).optional().or(z.literal('')),
  // '' is what an unselected dropdown submits, and Number('') is 0 — filter the
  // raw string before coercing or it becomes a bogus foreign key.
  personaId: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

function revalidateShowcase() {
  revalidatePath('/admin/showcase');
  // The block can be on any page, so repaint the whole public tree.
  revalidatePath('/', 'layout');
}

export async function saveShowcaseItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const { id, caption, mediaType, prompt, ...rest } = parsed.data;
  const values = {
    ...rest,
    caption: caption || null,
    mediaType: mediaType || 'image/png',
    prompt: prompt || null,
    showPrompt: formData.get('showPrompt') === 'on',
    isVisible: formData.get('isVisible') === 'on',
    updatedAt: new Date(),
  };

  if (id) await db.update(showcaseItems).set(values).where(eq(showcaseItems.id, id));
  else await db.insert(showcaseItems).values(values);

  revalidateShowcase();
  return { success: id ? 'Showcase item updated.' : 'Added to the showcase.' };
}

export async function toggleShowcaseItemAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const isVisible = formData.get('isVisible') === 'true';
  await db.update(showcaseItems).set({ isVisible: !isVisible, updatedAt: new Date() }).where(eq(showcaseItems.id, id));
  revalidateShowcase();
}

export async function deleteShowcaseItemAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  await db.delete(showcaseItems).where(eq(showcaseItems.id, id));
  revalidateShowcase();
}

export async function moveShowcaseItemAction(formData: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(formData.get('id'));
  const direction = z.enum(['up', 'down']).parse(formData.get('direction'));

  const rows = await db.select().from(showcaseItems).orderBy(asc(showcaseItems.position), asc(showcaseItems.id));
  const index = rows.findIndex((r) => r.id === id);
  const swap = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swap < 0 || swap >= rows.length) return;

  await db.transaction(async (tx) => {
    await tx.update(showcaseItems).set({ position: rows[swap].position }).where(eq(showcaseItems.id, rows[index].id));
    await tx.update(showcaseItems).set({ position: rows[index].position }).where(eq(showcaseItems.id, rows[swap].id));
  });

  revalidateShowcase();
}

/**
 * Promotes a generated image from a real conversation into the showcase.
 *
 * The **server** re-reads the message and takes the image, persona and prompt
 * from it — the form only supplies an id. A client that could pass its own URL
 * and caption here would be able to write arbitrary content into a public
 * surface with one admin's session.
 */
export async function promoteMessageAction(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const messageId = z.string().min(1).parse(formData.get('messageId'));
  const title = z.string().trim().min(1).max(120).catch('Untitled').parse(formData.get('title'));

  const [row] = await db
    .select({ message: messages, chat: chats })
    .from(messages)
    .leftJoin(chats, eq(chats.id, messages.chatId))
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!row) return { error: 'That message no longer exists.' };

  const image = (row.message.attachments ?? []).find((a) => a.kind === 'generated');
  if (!image) return { error: 'That message has no generated image.' };

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${showcaseItems.position}), -1)` })
    .from(showcaseItems);

  // The prompt is the user message immediately before this reply.
  const [askedFor] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.chatId, row.message.chatId), eq(messages.role, 'user')))
    .orderBy(desc(messages.position))
    .limit(1);

  await db.insert(showcaseItems).values({
    title,
    mediaUrl: image.url,
    mediaType: image.mediaType,
    prompt: askedFor?.content?.slice(0, 2000) ?? null,
    // Off by default when promoting: a real customer prompt can contain things
    // they would not expect to see published. Turn it on deliberately.
    showPrompt: false,
    personaId: row.chat?.personaId ?? null,
    messageId,
    position: Number(max) + 1,
    isVisible: true,
  });

  revalidateShowcase();
  return { success: 'Added to the showcase. Review the prompt before showing it.' };
}
