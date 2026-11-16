# Settings

**System → Settings.** The values that apply to the whole site, and every key and outside service.
On the left is a tree, like the taxonomy's: **Platform**, **AI**, **Money & messages**,
**Integrations** — AI providers, web search, voice, the curriculum, email, payments, storage (below) —
and **Appearance**. Hover an entry to see what it holds. On a phone the tree folds into one line at the
top.

## General

| Setting | Notes |
|---|---|
| **Site name** | Header, footer, browser tab, emails. |
| **Site description** | Search results and social previews. One clear sentence. |
| **Support email** | Where customers are told to write. |
| **Allow new registrations** | Turn off to close signups without taking the site down. |

## Integrations

**Settings → Integrations** holds every key and outside service (until 16 November 2026 this was its own
page, *System → Connections*; old links still work and open the right card). The tree lists the
groups — AI providers, Tools for bots (Tavily web search, ElevenLabs voice), Knowledge (the Curriculum
that tutor bots teach from), Email (Resend), Payments (Stripe, PayPal) and Storage (the image bucket) —
each with how many of its connections work, **1/6** for example; **All integrations** lists all
thirteen.

The list shows each connection as **Working**, **Failing**, **Never tested** or **Not set up**, and
when it was last tested. Click one and its card slides in. Each card works the same way: **Save** the key, press **Test**, and
once the test passes, **Fetch** what the service offers (models; voices for ElevenLabs — pick one to
make it the default voice; the key stages and subjects the curriculum key may see). See
[AI models](/admin/handbook/ai-models) and [Tutors that teach from the curriculum](/admin/handbook/curriculum-tutors).

Keys here override environment variables, so rotating one takes effect immediately with no deploy.
Leaving a key field blank keeps the existing value — blank never means "delete". Stripe, PayPal and
the storage bucket are configured in the server's env file on purpose: their cards show which values
are set (by name only) and offer a **Test** (nothing is charged).

## AI defaults

- **Default models** — what a persona uses when it has no model of its own.
- **Fallback provider** — used when nothing else specifies one. Normally OpenAI.
- **Category agents** — the Anthropic model each category's AI agent runs on. Blank means Claude
  Opus 5.5.

## Safety

- **Moderation** — word list, AI check or off.
- **Blocked words** — your own list, added to the built-in one.

## Billing

Bank transfer instructions and the invoice vendor name, then **Free use**:

- **Free messages before signup** — how much a visitor gets before registering. Three to five.
- **Credits given at signup** — granted on registration.

(The Stripe and PayPal checks are under Integrations → Payments.)

## Email

The From address mail is sent from. The Resend key, its **Test** and **Fetch domains** (which sender
domains are verified) are under Integrations → Email.

## Analytics

A Google Analytics ID. Leave blank for none.

## Localization

The site language for the public site and, separately, for the admin panel. Both default to
English. See [Translations](/admin/handbook/translations) — you'll normally change these from that
page, which also shows what's actually been translated.

## A note on secret fields

Any field marked secret shows dots, never the stored value. That's why blank means "leave alone":
there'd otherwise be no way to save the form without retyping every key.
