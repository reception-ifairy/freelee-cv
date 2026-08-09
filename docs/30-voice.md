# Voice (ElevenLabs)

Added 2026-08-09.

## The gap

`capabilities.voiceOut` used the browser's `speechSynthesis` — robotic, and different on every
operating system. `voiceIn` used `SpeechRecognition`, which **only exists in Chrome**: Firefox and
Safari users never saw a mic button at all.

For the Learning and Supportive chat layouts (docs/23), where reading aloud is a core affordance
for children and for accessibility rather than a flourish, that was the weakest working part of the
product.

## ⚠️ Status: unverified against the live API

**There is no ElevenLabs key on this deployment, so none of this has made a real request.** The
request shape follows their documented v1 API, but every other integration built this week had a
real bug that only appeared on a live call — the OpenAI `x-amz`-style header mismatch, the `public/`
404, the dialogue regex. Assume this one does too until someone runs it with a key.

What *is* verified: **the fallback path**. With no key configured, Read aloud silently uses the
browser voice and surfaces no error — confirmed in the real chat UI with a stubbed
`speechSynthesis`. So shipping this changes nothing until a key is added.

## How it behaves

`Read aloud` on an assistant message:

1. Calls `speakAction`, which checks conversation ownership (TTS costs money, so it must not be
   callable for someone else's chat) and whether a key is configured
2. With a key: ElevenLabs returns MP3, stored through the media driver (docs/26), played inline
3. Without a key, on any API error, on any exception: **falls back to the browser voice**

That fallback is deliberate and total. Losing the nicer voice must never mean losing read-aloud —
it is an accessibility feature, not a nice-to-have.

## Settings

| Setting | Notes |
|---|---|
| `elevenlabs_api_key` | Settings → AI. Absent = browser voice, no behaviour change. |
| `elevenlabs_voice_id` | Blank = ElevenLabs' default voice. |

Defaults to the **Flash** model — roughly half the price of Multilingual v2 and much lower latency,
which matters in a chat where someone is waiting.

`MAX_TTS_CHARACTERS` caps a single reply at 2,500 characters. Voice is billed per character of
output and personas are chatty; one long reply should not be able to cost pounds.

## Cost, before you switch it on

Roughly **$0.05 per 1,000 characters** on Flash, ~$0.10 on Multilingual v2. A typical 800-character
reply is a fraction of a penny — but read-aloud on *every* reply across a busy site is a real line
item. It's tap-to-play, not automatic, for exactly that reason.

## Not built

**Speech-to-text.** ElevenLabs Scribe would fix `voiceIn` being Chrome-only, and it's the more
valuable half for accessibility — every browser can record audio. It needs an upload path for the
recording and a transcription call, and is the obvious next step once the TTS half is confirmed
working.

---

# Speech-to-text (ElevenLabs Scribe)

Added 2026-08-09.

## The problem it fixes

`capabilities.voiceIn` used the browser's `SpeechRecognition` API. That API **only exists in
Chrome** — Firefox and Safari users saw no mic button at all. On the Learning and Supportive
layouts, where dictation is a genuine accessibility affordance rather than a nicety, that meant the
feature simply did not exist for a large share of visitors.

Scribe replaces it with a server-side transcription that works in any browser with `MediaRecorder`,
which is all of them.

## How it works

1. The composer records a clip with `MediaRecorder`, picking the first container the browser
   supports (`audio/webm;codecs=opus` in Chrome/Firefox, `audio/mp4` in Safari).
2. On stop, the microphone tracks are stopped **immediately** — leaving them live keeps the
   browser's recording indicator on, which reads to the user as the site still listening.
3. The clip is posted to `transcribeAction`, which checks conversation ownership (transcription
   costs money, same rule as TTS), then calls `POST /v1/speech-to-text` with `model_id=scribe_v1`.
4. The transcript is appended to whatever is already in the box, rather than replacing it.

## Fallback behaviour

`transcribeAction` returns `{ fallback: true }` — never a hard error — when ElevenLabs is
unconfigured or unreachable. The mic button then behaves exactly as it did before Scribe existed:
the Chrome-only recogniser, where available. Which route is in use is decided per browser:

| Browser | ElevenLabs key set | Result |
|---|---|---|
| Any | Yes | Scribe |
| Chrome | No | `SpeechRecognition` (as before) |
| Firefox / Safari | No | No mic button (as before) |

So this is strictly an improvement on what was there — nothing regresses when the key is absent.

## Verification status — updated

The earlier warning on this page said the ElevenLabs integration was completely unverified. That has
improved, though it is still not fully verified:

**Verified against the live API** — both `POST /v1/text-to-speech/{voice}` and
`POST /v1/speech-to-text` were called with a deliberately invalid key and both returned:

```
HTTP 401 {"detail":{"type":"authentication_error","code":"unauthorized","message":"Invalid API key"}}
```

A 401 means the URL, method, headers and (for Scribe) the multipart body all reached ElevenLabs'
authentication layer. A wrong path would have been a 404 and a malformed body a 422. So the request
shape is right up to authentication.

**Verified in a real browser** — with a key configured, in headless Chromium:

| Check | Result |
|---|---|
| Mic button appears once a key is configured | ✅ |
| Recording starts, label changes to "Stop dictating" | ✅ |
| Stopping uploads the clip and calls the action | ✅ |
| Invalid key degrades gracefully | ✅ "Using the browser voice instead — press the mic again." |
| No client-side errors anywhere in the flow | ✅ |

**Still unverified**: the response body on a *successful* call. Nobody has run either endpoint with
a valid key, so the audio playback path and the `{ text }` parse are still assumed correct. That is
the one remaining gap, and it needs nothing but a funded key to close.

## Cost guards

- `MAX_TTS_CHARACTERS = 2500` — one very long reply cannot cost pounds.
- `MAX_STT_BYTES = 10 MB` — checked in both the action and the library.
- Both paths require conversation ownership before spending anything.
