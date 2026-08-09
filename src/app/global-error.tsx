'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * The last line of defence: a crash in the root layout itself, where the normal
 * error boundary and the app's own chrome are already gone. It has to render
 * its own <html>/<body>, so it cannot use any of the site's layout components,
 * and the styles are inline for the same reason — the stylesheet may be exactly
 * what failed to load.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
            <p style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
              Something went wrong
            </p>
            <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.75rem' }}>We hit an unexpected error</h1>
            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
              The problem has been logged. Reloading the page usually clears it.
            </p>
            {error.digest ? (
              <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Reference: <code>{error.digest}</code>
              </p>
            ) : null}
            <a
              href="/"
              style={{
                display: 'inline-block', marginTop: '1.5rem', padding: '0.7rem 1.25rem',
                borderRadius: '0.75rem', background: '#4f46e5', color: '#fff',
                textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
