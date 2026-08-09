# Error Tracking (Sentry)

Until now, the only way to learn that something had broken for a customer was to read `pm2 logs`
and hope the failure was still in the buffer. Sentry gives that a memory.

It is **entirely optional**. With no DSN set, nothing initialises, nothing is sent, and the app
behaves exactly as it did before — verified, not assumed (see below).

## Turning it on

```bash
# /var/www/freelee.cv/app/.env.local
SENTRY_DSN="https://…@…ingest.sentry.io/…"     # server + edge
NEXT_PUBLIC_SENTRY_DSN="https://…"              # browser (optional)
SENTRY_ENVIRONMENT="production"                 # optional
SENTRY_TRACES_SAMPLE_RATE="0"                   # optional, default 0
```

Two of these behave differently and it matters:

| Variable | When it is read | To change it |
|---|---|---|
| `SENTRY_DSN` | Process start | `pm2 restart aigency-freelee --update-env` |
| `NEXT_PUBLIC_SENTRY_DSN` | **Bundled at build time** | Full `npm run build` |

Neither is hot-swappable from the admin panel, unlike the API keys in Settings. That is a
consequence of how Next.js inlines `NEXT_PUBLIC_*`, not a design choice.

Source-map upload is separate and needs `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`. The
build plugin is only applied when all three are present — otherwise `next.config.ts` exports the
plain config it always did, so an unconfigured box pays nothing at build time.

## Files

| File | Role |
|---|---|
| `src/lib/observability/sentry.ts` | DSN reading, noise filter, **the scrubber** |
| `sentry.server.config.ts` / `sentry.edge.config.ts` | Per-runtime `Sentry.init` |
| `src/instrumentation.ts` | Loads the right config; exports `onRequestError` |
| `src/instrumentation-client.ts` | Browser init + router transitions |
| `src/app/global-error.tsx` | Last-resort UI when the root layout itself crashes |

`global-error.tsx` renders its own `<html>`/`<body>` with inline styles, because at that point the
site's layout components and possibly its stylesheet are exactly what failed.

## What is filtered out

`isIgnorableError()` drops events that are control flow rather than defects:

- `NEXT_NOT_FOUND` and `NEXT_REDIRECT` digests — `notFound()` and `redirect()` throw by design.
- `AbortError` — routine on a streaming chat app whenever someone navigates away mid-reply.

Verified: a request to a route calling `notFound()` produced **no** event, while a genuine throw on
the same route did.

## What is scrubbed — read this before enabling

**`sendDefaultPii: false` is not enough.** Verified on 2026-08-09 against a local capture server
standing in for Sentry: with PII explicitly off, the SDK still sent

```json
"headers": { "cookie": "authjs.session-token=…", "authorization": "Bearer …" },
"cookies": { "authjs.session-token": "…" }
```

A session token in a third-party error tracker is enough to impersonate that user. `scrubEvent()`
therefore runs in every runtime's `beforeSend` and removes:

- `request.cookies` entirely
- `cookie`, `set-cookie`, `authorization`, `proxy-authorization`, `x-api-key`, `x-auth-token` headers
- `request.data` — request bodies here are chat messages and persona prompts
- query strings containing `token`, `code`, `key`, `secret`, `password`, `api_key`, `access_token`

That last one is not hypothetical. A password-reset link is `/reset-password?token=…`; a crash on
that page would otherwise hand a working reset token straight to Sentry. The **path** is kept so the
event stays debuggable:

```
"request_path": "/api/sentry-check?[redacted]"
```

The URL is redacted in several places, not just `request.url`. The first version of the scrubber
only handled `request`, and a token survived in `contexts.nextjs.request_path` — found by grepping
the captured envelope, not by reading the code.

## What was actually verified

A throwaway route (`/api/sentry-check`, deleted afterwards) was used with a DSN pointed at a local
HTTP server that captured the envelopes verbatim.

| Check | Result |
|---|---|
| No DSN → site works, zero envelopes sent | ✅ 0 |
| DSN set → error arrives | ✅ `"value":"sentry-wiring-check: deliberate test error"` |
| Correct endpoint | ✅ `POST /api/42/envelope/` |
| `notFound()` filtered | ✅ no `NEXT_NOT_FOUND` event |
| Session cookie leaked | ✅ 0 occurrences |
| `Authorization` header leaked | ✅ 0 occurrences |
| `?token=` leaked | ✅ 0 occurrences |
| Path still readable after redaction | ✅ |

One incidental finding: an App Router folder named `_sentry-check` is a **private folder** and never
routes — the first version of the test route 404'd for that reason, not because anything was wrong.

## Still open

- No real Sentry project has ever received an event from this box; the transport was verified
  against a stand-in server, which proves the wiring but not the account setup.
- Tracing is off (`tracesSampleRate: 0`). Turning it on has a cost and should be a deliberate call.
- No release tagging — without `SENTRY_AUTH_TOKEN` there are no source maps, so stack traces will
  point at minified chunks.
