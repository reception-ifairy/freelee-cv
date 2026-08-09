'use server';

import { z } from 'zod';
import { assertChatAccess } from '@/server/actions/chat';
import { synthesise, isVoiceConfigured } from '@/lib/voice/elevenlabs';
import { storeBase64 } from '@/lib/media/store';

/**
 * Turns a reply into speech and returns a URL the browser can play.
 *
 * Returns `{ fallback: true }` rather than an error when ElevenLabs isn't
 * configured or is unreachable, so the caller quietly uses the browser's own
 * voice. Losing the nicer voice should never mean losing read-aloud entirely —
 * that's an accessibility feature on the Learning and Supportive layouts.
 */
export type SpeakState = { url?: string; error?: string; fallback?: boolean } | null;

const schema = z.object({ chatId: z.string().min(1), text: z.string().trim().min(1) });

export async function speakAction(_prev: SpeakState, formData: FormData): Promise<SpeakState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fallback: true };

  // Same ownership rule as every other chat action — TTS costs money, so it
  // must not be callable for a conversation the caller doesn't own.
  const chat = await assertChatAccess(parsed.data.chatId);
  if (!chat) return { error: 'You do not have access to this conversation.' };

  if (!(await isVoiceConfigured())) return { fallback: true };

  const result = await synthesise(parsed.data.text);
  if ('error' in result) return { fallback: true, error: result.error };

  const stored = await storeBase64(Buffer.from(result.audio).toString('base64'), result.mediaType, 'speech');
  if (!stored) return { fallback: true };

  return { url: stored.url };
}
