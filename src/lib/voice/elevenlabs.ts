import 'server-only';
import { getSettingString } from '@/lib/settings';

/**
 * ElevenLabs text-to-speech.
 *
 * **Why this exists**: `capabilities.voiceOut` currently uses the browser's
 * `speechSynthesis`, which sounds robotic and varies by operating system, and
 * `voiceIn` uses `SpeechRecognition`, which **only exists in Chrome** — Firefox
 * and Safari users get no mic button at all. For the Learning and Supportive
 * chat layouts, where reading aloud is a core affordance rather than a nicety,
 * that was the weakest part of the product.
 *
 * ⚠️ **UNVERIFIED AGAINST THE LIVE API.** There is no ElevenLabs key on this
 * deployment, so none of this has made a real request. The request shape
 * follows their documented v1 API, but every other integration this week had a
 * real bug that only appeared on a live call — assume this one does too until
 * someone runs it. It is gated behind a configured key, so with no key nothing
 * changes and the browser fallback stays in place.
 */

const API = 'https://api.elevenlabs.io/v1';

/** Rachel — ElevenLabs' long-standing default. Overridable per site and per persona. */
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/** Flash is roughly half the price of Multilingual v2 and much lower latency, which suits chat. */
const DEFAULT_MODEL = 'eleven_flash_v2_5';

/** Guards against a runaway bill: one very long reply shouldn't cost pounds. */
export const MAX_TTS_CHARACTERS = 2500;

export type SpeechResult = { audio: Uint8Array; mediaType: string } | { error: string };

export async function isVoiceConfigured(): Promise<boolean> {
  return Boolean((await getSettingString('elevenlabs_api_key')) || process.env.ELEVENLABS_API_KEY);
}

export async function synthesise(text: string, voiceId?: string): Promise<SpeechResult> {
  const apiKey = (await getSettingString('elevenlabs_api_key')) || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { error: 'No ElevenLabs API key configured (Settings → AI).' };

  const trimmed = text.trim();
  if (!trimmed) return { error: 'Nothing to read.' };
  if (trimmed.length > MAX_TTS_CHARACTERS) {
    return { error: `That reply is too long to read aloud (over ${MAX_TTS_CHARACTERS} characters).` };
  }

  const voice = voiceId || (await getSettingString('elevenlabs_voice_id')) || DEFAULT_VOICE_ID;
  const model = (await getSettingString('elevenlabs_model')) || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${API}/text-to-speech/${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: trimmed, model_id: model }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // ElevenLabs returns JSON errors even on an audio endpoint; surfacing
      // the detail matters because "quota exceeded" and "bad voice id" need
      // completely different fixes from whoever sees the message.
      const detail = await response.text().catch(() => '');
      const message = detail.slice(0, 200) || `HTTP ${response.status}`;
      return { error: `ElevenLabs refused the request: ${message}` };
    }

    return { audio: new Uint8Array(await response.arrayBuffer()), mediaType: 'audio/mpeg' };
  } catch {
    return { error: 'Could not reach ElevenLabs. The browser voice will be used instead.' };
  } finally {
    clearTimeout(timeout);
  }
}

export type VoiceOption = { id: string; name: string };

/** Populates the voice picker in settings. Empty list on any failure — never throws. */
export async function listVoices(): Promise<VoiceOption[]> {
  const apiKey = (await getSettingString('elevenlabs_api_key')) || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey } });
    if (!response.ok) return [];
    const body = (await response.json()) as { voices?: { voice_id: string; name: string }[] };
    return (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name }));
  } catch {
    return [];
  }
}

/**
 * Speech-to-text (ElevenLabs Scribe).
 *
 * **Why this exists**: `capabilities.voiceIn` uses the browser's
 * `SpeechRecognition`, which is Chrome-only — Firefox and Safari users see no
 * mic button at all. Scribe replaces it with a server-side transcription that
 * works in any browser with `MediaRecorder`, i.e. everything current. When no
 * key is configured the composer falls back to the Chrome-only path, so this is
 * strictly an improvement on what was there.
 */

/** Their general-purpose model; `scribe_v1_experimental` exists but is not stable enough to default to. */
const DEFAULT_STT_MODEL = 'scribe_v1';

/** ElevenLabs accepts far larger files, but a chat dictation is seconds long — this is a cost guard, not a format limit. */
export const MAX_STT_BYTES = 10 * 1024 * 1024;

export type TranscriptResult = { text: string } | { error: string };

export async function isTranscriptionConfigured(): Promise<boolean> {
  return isVoiceConfigured();
}

export async function transcribe(audio: Uint8Array, mediaType: string): Promise<TranscriptResult> {
  const apiKey = (await getSettingString('elevenlabs_api_key')) || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { error: 'No ElevenLabs API key configured (Settings → AI).' };
  if (audio.byteLength === 0) return { error: 'Nothing was recorded.' };
  if (audio.byteLength > MAX_STT_BYTES) return { error: 'That recording is too long.' };

  const model = (await getSettingString('elevenlabs_stt_model')) || DEFAULT_STT_MODEL;

  const form = new FormData();
  // The extension has to match the media type — Scribe sniffs the filename as
  // well as the part's content type, and a mismatch is rejected as unsupported.
  const extension = mediaType.includes('mp4') ? 'mp4' : mediaType.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', new Blob([new Uint8Array(audio)], { type: mediaType }), `dictation.${extension}`);
  form.append('model_id', model);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${API}/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { error: `ElevenLabs refused the recording: ${detail.slice(0, 200) || `HTTP ${response.status}`}` };
    }

    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    return text ? { text } : { error: 'Nothing could be heard in that recording.' };
  } catch {
    return { error: 'Could not reach ElevenLabs.' };
  } finally {
    clearTimeout(timeout);
  }
}
