# Settings

**System → Settings.** Options that apply to the whole site, grouped into tabs.

## General

| Setting | Notes |
|---|---|
| **Site name** | Header, footer, browser tab, emails. |
| **Site description** | Search results and social previews. One clear sentence. |
| **Support email** | Where customers are told to write. |
| **Allow new registrations** | Turn off to close signups without taking the site down. |

## Media storage

Where uploaded and generated images are kept. The bucket is set in the server's env file, never
here; the card shows which values are set (by name only) and a **Test** button that checks the
bucket answers.

## Providers & keys

One card per service — OpenAI, Anthropic, Google, OpenRouter, Ollama, Stability, then the tools
(Tavily web search, ElevenLabs voice). Each works the same way: **Save** the key, press **Test**,
and once the test passes, **Fetch** what the service offers (models, or voices for ElevenLabs —
pick one to make it the default voice). See [AI models](/admin/handbook/ai-models).

Below the cards, **Defaults**:

- **Default models** — what a persona uses when it has no model of its own.
- **Fallback provider** — used when nothing else specifies one. Normally OpenAI.
- **Free messages before signup** — how much a visitor gets before registering. Three to five.
- **Credits given at signup** — granted on registration.
- **Moderation** — word list, AI check or off, plus your own blocked words.

Keys here override environment variables, so rotating one takes effect immediately with no deploy.
Leaving a key field blank keeps the existing value — blank never means "delete".

## Billing

Stripe and PayPal are configured in the server's env file on purpose — their cards only show which
values are set and offer a **Test** (nothing is charged). Below them: bank transfer instructions and
the invoice vendor name.

## Email

The Resend card (key, **Test**, and **Fetch domains** to see which sender domains are verified),
then the From address mail is sent from.

## Analytics

A Google Analytics ID. Leave blank for none.

## Localization

The site language for the public site and, separately, for the admin panel. Both default to
English. See [Translations](/admin/handbook/translations) — you'll normally change these from that
page, which also shows what's actually been translated.

## A note on secret fields

Any field marked secret shows dots, never the stored value. That's why blank means "leave alone":
there'd otherwise be no way to save the form without retyping every key.
