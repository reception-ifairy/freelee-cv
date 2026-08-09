'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { chats, messages, personaVersions, personas } from '@/db/schema';
import { assertChatAccess } from '@/server/actions/chat';
import { currentUser } from '@/lib/auth';
import { resolveImageModel, generateImage } from '@/lib/ai/generate-image';
import { storeBase64 } from '@/lib/media/store';
import { checkInput } from '@/lib/moderation/filter';
import { spendCredits, getBalanceForTeam, InsufficientCreditsError } from '@/lib/billing/credits';
import { hasActiveEntitlement } from '@/lib/billing/entitlements';
import type { ActionState } from './auth';

/**
 * Returns the two messages it created, so the caller can splice them straight
 * into the live transcript. Without this the client had no way to learn what
 * had happened server-side and fell back to reloading the whole page.
 */
export type GeneratedMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images: { url: string; mediaType: string }[];
};

export type ImageActionState = (ActionState & { created?: GeneratedMessage[] }) | null;

const schema = z.object({
  chatId: z.string().min(1),
  prompt: z.string().trim().min(3, 'Describe the image you want.').max(1000),
});

/**
 * Generates an image into a conversation.
 *
 * A server action rather than part of the streaming chat route, because
 * generation is a single slow request with no tokens to stream — modelling it
 * as a chat turn would mean pretending to stream something that arrives all at
 * once, and would tangle per-image billing into the per-token path.
 *
 * Billing order: **check** the balance up front so nobody starts a slow
 * generation they can't pay for, but only **charge** once an image is on disk.
 * A provider error, a content refusal or an unsavable format therefore costs
 * the user nothing, with no refund path to get wrong. The gap that leaves — a
 * user whose balance drops between the check and the charge — is bounded by
 * one image and resolves itself on the next attempt.
 */
export async function generateImageAction(_prev: ImageActionState, formData: FormData): Promise<ImageActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the prompt.' };
  const { chatId, prompt } = parsed.data;

  const chat = await assertChatAccess(chatId);
  if (!chat) return { error: 'You do not have access to this conversation.' };

  const [persona] = chat.personaId
    ? await db.select().from(personas).where(eq(personas.id, chat.personaId)).limit(1)
    : [undefined];
  const [version] = persona?.currentVersionId
    ? await db.select().from(personaVersions).where(eq(personaVersions.id, persona.currentVersionId)).limit(1)
    : [undefined];

  // Server-side capability enforcement — the button being hidden is not a
  // control, it's a convenience.
  if (!version?.capabilities.images) return { error: 'This assistant cannot create images.' };

  if (version.capabilities.badwordFilter) {
    const check = await checkInput(prompt);
    if (check.blocked) return { error: 'That description contains language this assistant will not act on.' };
  }

  const choice = await resolveImageModel();
  if (!choice) {
    return { error: 'No image model is configured. Add one in AI models and give its provider a key.' };
  }

  const user = await currentUser();
  if (!user) return { error: 'Create a free account to generate images.' };

  const covered = await hasActiveEntitlement(chat.teamId, 'platform');
  if (!covered && (await getBalanceForTeam(chat.teamId)) < choice.creditsPerImage) {
    return { error: `You need ${choice.creditsPerImage} credits to create an image. Top up to continue.` };
  }

  const result = await generateImage(choice, prompt);
  if ('error' in result) return { error: result.error };

  const stored = await storeBase64(result.image.base64, result.image.mediaType, 'generated');
  if (!stored) return { error: 'The image came back in a format we could not save.' };

  // Charged only once there is an image on disk to show for it. A provider
  // error above costs the user nothing.
  if (!covered) {
    try {
      await spendCredits(user.id, choice.creditsPerImage, {
        teamId: chat.teamId,
        description: `Image — ${choice.label}`,
        meta: { kind: 'image', model: choice.modelId, provider: choice.providerKey },
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) return { error: 'You ran out of credits.' };
      throw error;
    }
  }

  const position = (await db.$count(messages, eq(messages.chatId, chatId))) + 1;
  const promptText = `Create an image: ${prompt}`;
  const replyText = `Here's the image you asked for.`;

  const inserted = await db
    .insert(messages)
    .values([
      { chatId, role: 'user', content: promptText, position, status: 'complete' },
      {
        chatId,
        role: 'assistant',
        content: replyText,
        attachments: [stored],
        position: position + 1,
        status: 'complete',
      },
    ])
    .returning({ id: messages.id, role: messages.role });

  await db.update(chats).set({ lastMessageAt: new Date() }).where(eq(chats.id, chatId));

  // Still revalidated so a *fresh* load of the page is correct — the returned
  // messages only fix the transcript that's already open.
  revalidatePath(`/chat/${chatId}`);

  return {
    success: `Created with ${choice.label}.`,
    created: [
      { id: inserted[0].id, role: 'user', text: promptText, images: [] },
      { id: inserted[1].id, role: 'assistant', text: replyText, images: [{ url: stored.url, mediaType: stored.mediaType }] },
    ],
  };
}
