import * as Sentry from '@sentry/nextjs';
import { serverDsn, SENTRY_ENVIRONMENT, isIgnorableError, scrubEvent } from '@/lib/observability/sentry';

const dsn = serverDsn();

if (dsn) {
  Sentry.init({
    dsn,
    environment: SENTRY_ENVIRONMENT,
    // Traces cost money and this is a single box; sampling defaults to off and
    // is opt-in via env so turning it on is a deliberate act.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // Never ship request bodies or headers — chat messages are user content and
    // some of it is confidential by the nature of the personas on this site.
    sendDefaultPii: false,
    beforeSend(event, hint) {
      if (isIgnorableError(hint?.originalException)) return null;
      return scrubEvent(event);
    },
  });
}
