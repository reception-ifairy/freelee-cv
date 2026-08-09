/**
 * Sentry is entirely optional. Everything here is a no-op unless a DSN is set,
 * so a box with no DSN behaves exactly as it did before Sentry was added — no
 * network calls, no startup cost, no swallowed errors.
 *
 * Note the split in how the two DSNs are read:
 *   - SENTRY_DSN (server) is read at process start, so `pm2 restart` is enough.
 *   - NEXT_PUBLIC_SENTRY_DSN (browser) is inlined by the bundler at build time,
 *     so changing it needs a full `npm run build`, not just a restart.
 * Unlike the API keys in Settings, neither is hot-swappable from the admin UI.
 */

export function serverDsn(): string | undefined {
  return process.env.SENTRY_DSN?.trim() || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(serverDsn());
}

/** Release + environment, shared by every runtime so events group together. */
export const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production';

/**
 * Drop events that are noise rather than defects: aborted streams (the user
 * navigated away mid-reply — routine on a streaming chat app), and the
 * Next.js redirect/notFound control-flow "errors", which are not errors.
 */
export function isIgnorableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === 'string' && (digest === 'NEXT_NOT_FOUND' || digest.startsWith('NEXT_REDIRECT'))) {
    return true;
  }
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError';
}

/**
 * Headers that must never leave this box. `sendDefaultPii: false` is NOT enough
 * on its own — verified against a live capture server on 2026-08-09: with PII
 * off, Sentry still attached the full `cookie` and `authorization` headers and a
 * parsed `request.cookies` map, which is a session token in a third-party tool,
 * i.e. enough to impersonate the user.
 */
const SENSITIVE_HEADERS = new Set([
  'cookie',
  'set-cookie',
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
]);

/** Query params that are credentials in their own right. */
const SENSITIVE_PARAMS = /(^|&)(token|code|key|secret|password|api_key|access_token)=/i;

type SentryEventLike = {
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    url?: string;
    query_string?: unknown;
  };
  transaction?: unknown;
  contexts?: Record<string, Record<string, unknown> | undefined>;
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>;
};

/** Replace a sensitive query string with a marker, keeping the path readable. */
export function redactQuery(value: string): string {
  if (!value.includes('?')) return SENSITIVE_PARAMS.test(value) ? '[redacted]' : value;
  const [path, search] = value.split(/\?(.*)/s);
  return search && SENSITIVE_PARAMS.test(search) ? `${path}?[redacted]` : value;
}

function redactField(bag: Record<string, unknown> | undefined, key: string): void {
  const value = bag?.[key];
  if (typeof value === 'string') bag![key] = redactQuery(value);
}

/**
 * Strip credentials and user content from an event before it is sent. Applied in
 * every runtime's `beforeSend`, so there is no path that skips it.
 *
 * The URL is redacted in several places, not just `request.url`: Sentry's Next.js
 * integration also records the raw path under `contexts.nextjs.request_path`,
 * which is where a `?token=` survived the first version of this function.
 */
export function scrubEvent<T extends SentryEventLike>(event: T): T {
  const req = event.request;
  if (req) {
    delete req.cookies;
    // Request bodies on this app are chat messages, persona prompts and
    // credentials — none of it belongs in an error report.
    delete req.data;

    if (req.headers) {
      for (const name of Object.keys(req.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) delete req.headers[name];
      }
    }

    // A password-reset link is `/reset-password?token=...`; a crash on that page
    // would otherwise hand the token straight to Sentry.
    if (typeof req.query_string === 'string' && SENSITIVE_PARAMS.test(req.query_string)) {
      req.query_string = '[redacted]';
    }
    if (typeof req.url === 'string') req.url = redactQuery(req.url);
  }

  if (typeof event.transaction === 'string') event.transaction = redactQuery(event.transaction);

  redactField(event.contexts?.nextjs, 'request_path');
  redactField(event.contexts?.trace, 'description');
  redactField(event.contexts?.trace?.data as Record<string, unknown> | undefined, 'url.query');
  redactField(event.contexts?.trace?.data as Record<string, unknown> | undefined, 'http.url');

  for (const crumb of event.breadcrumbs ?? []) {
    redactField(crumb.data, 'url');
    redactField(crumb.data, 'to');
    redactField(crumb.data, 'from');
  }

  return event;
}
