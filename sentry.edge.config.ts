import * as Sentry from '@sentry/nextjs';
import { serverDsn, SENTRY_ENVIRONMENT, isIgnorableError, scrubEvent } from '@/lib/observability/sentry';

const dsn = serverDsn();

if (dsn) {
  Sentry.init({
    dsn,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
    beforeSend(event, hint) {
      if (isIgnorableError(hint?.originalException)) return null;
      return scrubEvent(event);
    },
  });
}
