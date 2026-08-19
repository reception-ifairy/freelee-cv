import * as Sentry from '@sentry/nextjs';
import { isIgnorableError, isSentryEnabled } from '@/lib/observability/sentry';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // The job worker lives in this process rather than a second pm2 app — the
    // same judgement already written into crews/runner.ts about not standing
    // up infrastructure that has not been earned.
    //
    // Guarded three ways: `NEXT_RUNTIME === 'nodejs'` above (this hook also
    // fires for the edge runtime, which has no database), `startWorker`'s own
    // module-level flag (next dev calls register() more than once), and the
    // build check below — `next build` executes this module, and a build must
    // not start polling a production database.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      const { startJobs } = await import('@/lib/jobs/register');
      startJobs();
    }
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
