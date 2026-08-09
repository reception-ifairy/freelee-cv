import * as Sentry from '@sentry/nextjs';
import { SENTRY_ENVIRONMENT, isIgnorableError, scrubEvent } from '@/lib/observability/sentry';

// Inlined at build time — see the note in lib/observability/sentry.ts.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event, hint) {
      if (isIgnorableError(hint?.originalException)) return null;
      return scrubEvent(event);
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
