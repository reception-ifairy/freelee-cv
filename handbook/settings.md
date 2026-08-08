# Settings

**System → Settings.** Options that apply to the whole site, grouped into tabs.

## General

| Setting | Notes |
|---|---|
| **Site name** | Header, footer, browser tab, emails. |
| **Site description** | Search results and social previews. One clear sentence. |
| **Support email** | Where customers are told to write. |
| **Allow new registrations** | Turn off to close signups without taking the site down. |

## AI

Your provider API keys, plus:

- **Default provider** — used when nothing else specifies one. Normally `openai`.
- **Free messages before signup** — how much a visitor gets before registering. Three to five.
- **Signup bonus credits** — granted on registration.

Keys here override environment variables, so rotating one takes effect immediately with no deploy.
Leaving a key field blank keeps the existing value — blank never means "delete".

## Billing

Bank transfer instructions and the invoice vendor name. Card payments are configured with your
gateway keys, not here.

## Analytics

A Google Analytics ID. Leave blank for none.

## Localization

The site language for the public site and, separately, for the admin panel. Both default to
English. See [Translations](/admin/handbook/translations) — you'll normally change these from that
page, which also shows what's actually been translated.

## A note on secret fields

Any field marked secret shows dots, never the stored value. That's why blank means "leave alone":
there'd otherwise be no way to save the form without retyping every key.
