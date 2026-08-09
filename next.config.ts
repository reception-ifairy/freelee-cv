import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com' }],
  },
  async headers() {
    return [
      {
        // Streaming must not be buffered by any intermediary.
        source: '/api/chat',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
      {
        // Embeddable persona widgets are the one thing allowed to be framed.
        // X-Frame-Options has no "allow any origin" value (ALLOW-FROM is dead
        // in every current browser), so this route omits it entirely and uses
        // CSP frame-ancestors instead — the modern mechanism, and the only one
        // that can express "any site may embed this".
        //
        // Framing here is safe because /embed/[slug] is public, read-only
        // chrome around a chat, gated on the persona's own `embed` capability.
        // It exposes nothing an anonymous visitor couldn't already reach.
        source: '/embed/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Everything else stays un-framable. The negative lookahead is what
        // keeps DENY off /embed — a later, more specific rule would not
        // override an earlier DENY, both headers would be sent.
        source: '/((?!embed/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

/**
 * The Sentry build plugin only earns its keep when there is an auth token to
 * upload source maps with. Without one it adds build time and warnings for
 * nothing, so an unconfigured box gets the plain config it had before — error
 * capture itself is a runtime concern and works either way.
 */
const sentryConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default sentryConfigured
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      // Source maps are uploaded to Sentry, then deleted so they are never
      // served publicly from this box.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      disableLogger: true,
    })
  : config;
