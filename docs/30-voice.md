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
