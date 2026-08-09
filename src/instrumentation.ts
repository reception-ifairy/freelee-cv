import * as Sentry from '@sentry/nextjs';
import { isIgnorableError, isSentryEnabled } from '@/lib/observability/sentry';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Next.js hands every uncaught server error here. Guarded on both the DSN and
 * the noise filter so an unconfigured box does no work at all.
 */
export const onRequestError: typeof Sentry.captureRequestError = (err, request, context) => {
  if (!isSentryEnabled() || isIgnorableError(err)) return;
  return Sentry.captureRequestError(err, request, context);
};
